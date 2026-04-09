import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";

// Download external image URLs to the site's public directory
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
    } catch (err: any) {
      console.error(`[Localize] Error: ${err.message}`);
      return url;
    }
  }
  return url;
}

function escapeStr(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

/**
 * POST /api/websites/[id]/update-data
 *
 * Flow:
 * 1. Localize ALL external image URLs FIRST (download to disk)
 * 2. Then write everything to data.ts + component files
 * 3. Save to DB
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await request.json();
    const data = body.data;
    if (!data) return NextResponse.json({ error: "Data required" }, { status: 400 });

    const basePath = `/sites/${website.slug}`;
    const siteDir = website.generatedPath || getSiteDir(id);

    // ========== STEP 1: Localize ALL images FIRST ==========
    if (data.logo?.startsWith("http")) {
      data.logo = await localizeImage(data.logo, siteDir, "brand", basePath);
    }
    if (data.heroImages) {
      for (let i = 0; i < data.heroImages.length; i++) {
        if (data.heroImages[i]?.startsWith("http")) {
          data.heroImages[i] = await localizeImage(data.heroImages[i], siteDir, "hero", basePath);
        }
      }
    }
    if (data.services) {
      for (const svc of data.services) {
        if (svc.image?.startsWith("http")) {
          svc.image = await localizeImage(svc.image, siteDir, "services", basePath);
        }
      }
    }
    if (data.team) {
      for (const m of data.team) {
        if (m.image?.startsWith("http")) {
          m.image = await localizeImage(m.image, siteDir, "team", basePath);
        }
      }
    }
    if (data.blogPosts) {
      for (const p of data.blogPosts) {
        if (p.image?.startsWith("http")) {
          p.image = await localizeImage(p.image, siteDir, "blog", basePath);
        }
      }
    }
    if (data.galleryImages) {
      for (const g of data.galleryImages) {
        if (g.src?.startsWith("http")) {
          g.src = await localizeImage(g.src, siteDir, "gallery", basePath);
        }
      }
    }

    // ========== STEP 2: Save to DB ==========
    await prisma.website.update({
      where: { id },
      data: { siteData: JSON.stringify(data) },
    });

    // ========== STEP 3: Write data.ts ==========
    const dataPath = join(siteDir, "src", "lib", "data.ts");
    try {
      let content = readFileSync(dataPath, "utf-8");

      // --- Company info (field-by-field replace in companyInfo object) ---
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
            // Match field: 'value' or field: "value" — must close with SAME quote type
            // Use double quotes in output to avoid apostrophe issues
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

      // --- Stats ---
      if (data.stats) {
        for (const s of data.stats) {
          content = content.replace(new RegExp(`(${s.label}):\\s*\\d+`), `${s.label}: ${s.value}`);
        }
      }

      // --- Navigation links (full rebuild) ---
      if (data.navLinks) {
        const code = data.navLinks.map((l: any) => {
          let href = l.href || "";
          // Prefix bare internal paths with basePath
          if (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) {
            href = basePath + href;
          }
          return `  { href: '${escapeStr(href)}', label: '${escapeStr(l.label || "")}' }`;
        }).join(",\n");
        content = content.replace(/export const navLinks\s*=\s*\[[\s\S]*?\n\]/, `export const navLinks = [\n${code}\n]`);
      }
      if (data.footerLinks) {
        const code = data.footerLinks.map((l: any) => {
          let href = l.href || "";
          if (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) {
            href = basePath + href;
          }
          return `  { href: '${escapeStr(href)}', label: '${escapeStr(l.label || "")}' }`;
        }).join(",\n");
        content = content.replace(
          /export const footerLinks\s*=\s*\[[\s\S]*?\n\]/,
          `export const footerLinks = [\n  ...navLinks,\n${code}\n]`
        );
      }

      // --- Services (full rebuild) ---
      if (data.services) {
        const code = data.services.map((s: any) => `  {
    id: '${escapeStr(s.id || "")}',
    title: '${escapeStr(s.title || "")}',
    shortDescription: '${escapeStr(s.shortDescription || "")}',
    description: '${escapeStr(s.description || "")}',
    icon: '${escapeStr(s.icon || "Star")}',
    image: '${escapeStr(s.image || "")}',${s.link ? `\n    link: '${escapeStr(s.link)}',` : ""}
  }`).join(",\n");
        content = content.replace(/export const services\s*=\s*\[[\s\S]*?\n\]/, `export const services = [\n${code}\n]`);
      }

      // --- Team (full rebuild, preserve export name) ---
      if (data.team) {
        const exportName = content.match(/export const (teamMembers|team)\s*=/)?.[1] || "team";
        const code = data.team.map((t: any) => `  {
    name: '${escapeStr(t.name || "")}',
    role: '${escapeStr(t.role || "")}',
    bio: '${escapeStr(t.bio || "")}',
    image: '${escapeStr(t.image || "")}',
  }`).join(",\n");
        content = content.replace(/export const (?:teamMembers|team)\s*=\s*\[[\s\S]*?\n\]/, `export const ${exportName} = [\n${code}\n]`);
      }

      // --- FAQ (full rebuild, preserve export name) ---
      if (data.faq) {
        const exportName = content.match(/export const (faqItems|faqs?)\s*=/)?.[1] || "faqItems";
        const code = data.faq.map((f: any) => `  {
    question: '${escapeStr(f.question || "")}',
    answer: '${escapeStr(f.answer || "")}',
  }`).join(",\n");
        content = content.replace(/export const (?:faqItems|faqs?)\s*=\s*\[[\s\S]*?\n\]/, `export const ${exportName} = [\n${code}\n]`);
      }

      // --- Testimonials (full rebuild) ---
      if (data.testimonials) {
        const code = data.testimonials.map((t: any) => `  {
    name: '${escapeStr(t.name || "")}',
    role: '${escapeStr(t.role || "")}',
    rating: ${t.rating || 5},
    text: '${escapeStr(t.text || "")}',
    avatar: '${(t.name || "").split(" ").map((w: string) => w[0] || "").join("").substring(0, 2).toUpperCase()}',
  }`).join(",\n");
        content = content.replace(/export const testimonials\s*=\s*\[[\s\S]*?\n\]/, `export const testimonials = [\n${code}\n]`);
      }

      // --- Blog posts (full rebuild) ---
      if (data.blogPosts) {
        const code = data.blogPosts.map((b: any) => `  {
    id: '${escapeStr(b.id || "")}',
    title: '${escapeStr(b.title || "")}',
    excerpt: '${escapeStr(b.excerpt || "")}',
    content: '${escapeStr(b.content || "")}',
    category: '${escapeStr(b.category || "")}',
    date: '${escapeStr(b.date || "")}',
    author: '${escapeStr(b.author || "")}',
    image: '${escapeStr(b.image || "")}',
  }`).join(",\n");
        content = content.replace(/export const blogPosts\s*=\s*\[[\s\S]*?\n\]/, `export const blogPosts = [\n${code}\n]`);
      }

      // --- Gallery images (full rebuild) ---
      if (data.galleryImages) {
        const code = data.galleryImages.map((g: any) => `  {
    src: '${escapeStr(g.src || "")}',
    alt: '${escapeStr(g.alt || "")}',
    category: '${escapeStr(g.category || "")}',
  }`).join(",\n");
        content = content.replace(/export const galleryImages\s*=\s*\[[\s\S]*?\n\]/, `export const galleryImages = [\n${code}\n]`);
      }

      writeFileSync(dataPath, content);
      console.log(`[UpdateData] Written data.ts`);
    } catch (err) {
      console.error("[UpdateData] data.ts write error:", err);
    }

    // ========== STEP 4: Update component files ==========

    // Hero slides
    if (data.heroImages?.length) {
      const heroPath = join(siteDir, "src", "components", "Hero.tsx");
      try {
        let c = readFileSync(heroPath, "utf-8");

        // Check if the Hero component already supports image slides (has src: in slides array)
        const hasImageSlides = /slides\s*=\s*\[[\s\S]*?src:\s*['"]/m.test(c);

        if (hasImageSlides) {
          // Simple replacement — component already renders images
          const code = data.heroImages.map((img: string, i: number) => `  {\n    src: '${escapeStr(img)}',\n    alt: 'Slide ${i + 1}',\n  }`).join(",\n");
          c = c.replace(/const slides\s*=\s*\[[\s\S]*?\];/, `const slides = [\n${code}\n];`);
          writeFileSync(heroPath, c);
          console.log(`[UpdateData] Hero.tsx slides updated (image-compatible)`);
        } else {
          // Hero uses emoji/text slides — needs AI to rewrite the component
          // to support background images with the user's uploaded photos
          console.log(`[UpdateData] Hero.tsx not image-compatible — AI rewriting synchronously`);
          const slidesCode = data.heroImages.map((img: string, i: number) =>
            `  { src: '${escapeStr(img)}', alt: 'Slide ${i + 1}' }`
          ).join(",\n");
          await rewriteComponent(heroPath, c,
            `The user has uploaded hero images for a slideshow. Rewrite this Hero component to display these images as full-screen background image slideshow with smooth transitions.

USE THESE EXACT IMAGE PATHS — copy them verbatim into a slides array:
const slides = [
${slidesCode}
];

Remove any emoji/text/icon slides. Use the images as full-width background images with the existing headline, tagline, and CTA buttons overlaid on top using a semi-transparent gradient overlay for text readability.

THEMING (CRITICAL):
- The component MUST support BOTH light and dark mode using Tailwind "dark:" prefix
- Do NOT hardcode dark backgrounds (bg-black, bg-gray-900, bg-neutral-900, etc.) without a light-mode default
- The overlay gradient on top of images should work in both modes, e.g. from-black/60 is OK because it's over a photo, but any section background outside the slideshow must use light defaults with dark: variants (e.g. bg-white dark:bg-neutral-950)
- Text colors: use text-gray-900 dark:text-white or similar pairs
- Badge/pill backgrounds: use bg-white/90 dark:bg-neutral-800/90 or similar

STATIC EXPORT RULES:
- Render ALL slides using .map(), absolutely positioned within a relative container
- The first slide (index 0) MUST have opacity-100, all others opacity-0 — use: className={\`... \${i === current ? 'opacity-100' : 'opacity-0'} transition-opacity duration-1000\`}
- Do NOT use framer-motion (AnimatePresence, motion.div) for the slideshow
- Use useState for slide index (default 0), useEffect for auto-advance timer
- Each slide image: <img src={slide.src} alt={slide.alt} className="w-full h-full object-cover" />
- The first slide MUST be visible without JavaScript`,
            basePath
          );
        }
      } catch {}
    }

    // Logo in Header, Footer, layout favicon
    // Skip __svg__ placeholder — it's not a real image path
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
      } catch {}

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
      } catch {}

      // Favicon
      try {
        const p = join(siteDir, "src", "app", "layout.tsx");
        let c = readFileSync(p, "utf-8");
        c = c.replace(/icon:\s*['"][^'"]*['"]/, `icon: '${escapeStr(data.logo)}'`);
        writeFileSync(p, c);
      } catch {}

      console.log(`[UpdateData] Logo updated in Header, Footer, favicon`);
    }

    // --- Page images (replace SVG illustrations with uploaded images) ---
    if (data.pageImages) {
      for (const [pageSlug, imageUrl] of Object.entries(data.pageImages)) {
        if (!imageUrl) continue;
        // Localize if external
        let imgPath = imageUrl as string;
        if (imgPath.startsWith("http")) {
          imgPath = await localizeImage(imgPath, siteDir, pageSlug, basePath);
          data.pageImages[pageSlug] = imgPath;
        }

        // Find the component that renders this page's illustration
        // Common patterns: About.tsx has ChurchBuilding/SVG, Services page has illustrations
        const componentNames = ["About", "Services", "Team", "Gallery"];
        const capitalSlug = pageSlug.charAt(0).toUpperCase() + pageSlug.slice(1);
        const filesToCheck = [
          join(siteDir, "src", "components", `${capitalSlug}.tsx`),
          join(siteDir, "src", "app", pageSlug, "page.tsx"),
        ];

        for (const filePath of filesToCheck) {
          try {
            let fileContent = readFileSync(filePath, "utf-8");
            // Replace SVG component references with img tag
            // Pattern: <SomeIllustration /> or <ChurchBuilding /> etc
            const svgComponentRegex = /<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|Illustration|SvgIllustration|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g;
            if (svgComponentRegex.test(fileContent)) {
              fileContent = fileContent.replace(svgComponentRegex, `<img src="${escapeStr(imgPath)}" alt="${capitalSlug}" className="w-full h-full object-cover rounded-2xl" />`);
              writeFileSync(filePath, fileContent);
              console.log(`[UpdateData] Replaced SVG illustration in ${filePath} with ${imgPath}`);
            }
          } catch {}
        }
      }
    }
    if (data.aboutImage) {
      // Also handle aboutImage specifically for backward compat
      const aboutPath = join(siteDir, "src", "components", "About.tsx");
      try {
        let c = readFileSync(aboutPath, "utf-8");
        const svgRegex = /<(?:ChurchBuilding|OfficeBuildingSVG|WorkersSVG|[A-Z]\w*SVG|[A-Z]\w*Illustration)\s*\/>/g;
        if (svgRegex.test(c)) {
          let imgPath = data.aboutImage;
          if (imgPath.startsWith("http")) imgPath = await localizeImage(imgPath, siteDir, "about", basePath);
          c = c.replace(svgRegex, `<img src="${escapeStr(imgPath)}" alt="About" className="w-full h-full object-cover rounded-2xl" />`);
          writeFileSync(aboutPath, c);
          console.log(`[UpdateData] Replaced About SVG with image`);
        }
      } catch {}
    }

    // --- NavLinks + FooterLinks (prefix bare paths with basePath) ---
    try {
      let content = readFileSync(dataPath, "utf-8");
      const prefixHref = (href: string) => {
        if (href.startsWith("/") && !href.startsWith(basePath) && !href.startsWith("/http")) {
          return basePath + href;
        }
        return href;
      };
      if (data.navLinks) {
        const navCode = data.navLinks.map((l: any) => `  { href: '${escapeStr(prefixHref(l.href || ""))}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
        content = content.replace(/export const navLinks\s*=\s*\[[\s\S]*?\n\]/, `export const navLinks = [\n${navCode}\n]`);
      }
      if (data.footerLinks) {
        const fCode = data.footerLinks.map((l: any) => `  { href: '${escapeStr(prefixHref(l.href || ""))}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
        if (content.includes("export const footerLinks")) {
          content = content.replace(/export const footerLinks\s*=\s*\[[\s\S]*?\n\]/, `export const footerLinks = [\n${fCode}\n]`);
        } else {
          content += `\nexport const footerLinks = [\n${fCode}\n]\n`;
        }
      }
      writeFileSync(dataPath, content);
    } catch {}

    // ========== STEP 5: Detect & fix component mismatches ==========
    // If user added data that the component doesn't support, trigger AI rewrite
    detectAndFixMismatches(siteDir, data, basePath);

    console.log(`[UpdateData] Complete for ${website.slug}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

/**
 * Detect mismatches between user data and component capabilities.
 * If user added images/content that the component can't render, AI rewrites the component.
 * Synchronous — waits for AI to finish before returning.
 */
async function detectAndFixMismatches(siteDir: string, data: any, basePath: string) {
  const checks: Array<{
    condition: boolean;
    filePath: string;
    detectField: string;
    prompt: string;
  }> = [
    {
      condition: data.services?.some((s: any) => s.image),
      filePath: join(siteDir, "src", "app", "services", "page.tsx"),
      detectField: "image",
      prompt: `The user has added images to their services. Update this component to display each service's image (from the services array in data.ts). Show images as cards or alongside the service description.`,
    },
    {
      condition: data.team?.some((t: any) => t.image),
      filePath: join(siteDir, "src", "app", "team", "page.tsx"),
      detectField: "image",
      prompt: `The user has added photos for team members. Update this component to display each team member's photo (from the team array in data.ts). Show photos in a professional team grid layout.`,
    },
    {
      condition: data.galleryImages?.length > 0,
      filePath: join(siteDir, "src", "app", "gallery", "page.tsx"),
      detectField: "galleryImages",
      prompt: `The user has added gallery images. Make sure this component imports and renders the galleryImages array from data.ts. Each item has {src, alt, category}. Show in a responsive grid layout.`,
    },
    {
      condition: data.blogPosts?.some((b: any) => b.image),
      filePath: join(siteDir, "src", "app", "blog", "page.tsx"),
      detectField: ".image",
      prompt: `The user has added images to blog posts. Update this component to display each blog post's image (from blogPosts in data.ts). Show images as card thumbnails.`,
    },
  ];

  for (const check of checks) {
    if (!check.condition) continue;
    if (!existsSync(check.filePath)) continue;

    try {
      const code = readFileSync(check.filePath, "utf-8");
      if (!code.includes(check.detectField)) {
        console.log(`[UpdateData] Mismatch: ${check.filePath.split("/").pop()} missing '${check.detectField}' — AI fixing`);
        await rewriteComponent(check.filePath, code, check.prompt, basePath);
      }
    } catch {}
  }
}

/**
 * AI component rewriter — synchronous. Reads current code, calls Claude,
 * writes back the updated component. Awaited by caller.
 */
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
- For slideshows: render ALL slides using .map(), absolutely positioned, first slide opacity-100 others opacity-0, use transition-opacity for fading
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
      .replace(/^(?:javascript|tsx?|jsx)\s*\n/i, "") // Strip stray language label
      .trim();

    // Ensure 'use client' is first if the original had it
    if (currentCode.includes("'use client'") && !updated.startsWith("'use client'") && !updated.startsWith('"use client"')) {
      updated = "'use client'\n\n" + updated;
    }

    if (updated && updated.length > 100) {
      writeFileSync(filePath, updated);
      console.log(`[UpdateData] AI rewrote: ${filePath.split("/").pop()}`);
    }
  } catch (err) {
    console.error(`[UpdateData] AI rewrite failed:`, err);
  }
}
