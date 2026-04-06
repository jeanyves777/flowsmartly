import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
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
          ["website", c.website],
        ];
        for (const [k, v] of fields) {
          if (v !== undefined && v !== null) {
            content = content.replace(new RegExp(`(${k}:\\s*['"])[\\s\\S]*?(?:(?<!\\\\)['"])`, "m"), `${k}: '${escapeStr(v)}'`);
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

      // --- Services (full rebuild) ---
      if (data.services) {
        const code = data.services.map((s: any) => `  {
    id: '${escapeStr(s.id || "")}',
    title: '${escapeStr(s.title || "")}',
    shortDescription: '${escapeStr(s.shortDescription || "")}',
    description: '${escapeStr(s.description || "")}',
    icon: '${escapeStr(s.icon || "Star")}',
    image: '${escapeStr(s.image || "")}',
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
        const code = data.heroImages.map((img: string, i: number) => `  {\n    src: '${escapeStr(img)}',\n    alt: 'Slide ${i + 1}',\n  }`).join(",\n");
        c = c.replace(/const slides\s*=\s*\[[\s\S]*?\];/, `const slides = [\n${code}\n];`);
        writeFileSync(heroPath, c);
        console.log(`[UpdateData] Hero.tsx slides updated`);
      } catch {}
    }

    // Logo in Header, Footer, layout favicon
    if (data.logo) {
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

    // --- NavLinks + FooterLinks ---
    try {
      let content = readFileSync(dataPath, "utf-8");
      if (data.navLinks) {
        const navCode = data.navLinks.map((l: any) => `  { href: '${escapeStr(l.href || "")}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
        content = content.replace(/export const navLinks\s*=\s*\[[\s\S]*?\n\]/, `export const navLinks = [\n${navCode}\n]`);
      }
      if (data.footerLinks) {
        const fCode = data.footerLinks.map((l: any) => `  { href: '${escapeStr(l.href || "")}', label: '${escapeStr(l.label || "")}' }`).join(",\n");
        if (content.includes("export const footerLinks")) {
          content = content.replace(/export const footerLinks\s*=\s*\[[\s\S]*?\n\]/, `export const footerLinks = [\n${fCode}\n]`);
        } else {
          content += `\nexport const footerLinks = [\n${fCode}\n]\n`;
        }
      }
      writeFileSync(dataPath, content);
    } catch {}

    console.log(`[UpdateData] Complete for ${website.slug}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
