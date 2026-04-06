import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSiteDir } from "@/lib/website/site-builder";

// Download external image URLs to the site's public directory
async function localizeImage(url: string, siteDir: string, category: string): Promise<string> {
  if (!url) return url;
  // Already a local path
  if (url.startsWith("/images/")) return url;
  // External URL (S3 presigned or any http URL) — download it
  if (url.startsWith("http")) {
    try {
      // Strip presigned query params to get clean S3 URL for download
      let downloadUrl = url;
      if (url.includes("X-Amz-")) {
        // Extract the base S3 URL without presigned params — bucket has public read
        const cleanUrl = url.split("?")[0];
        console.log(`[LocalizeImage] Using clean S3 URL: ${cleanUrl}`);
        downloadUrl = cleanUrl;
      }

      console.log(`[LocalizeImage] Downloading: ${downloadUrl.substring(0, 100)}...`);
      const res = await fetch(downloadUrl);
      if (!res.ok) {
        console.error(`[LocalizeImage] Download failed: ${res.status} ${res.statusText}`);
        return url;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 100) {
        console.error(`[LocalizeImage] Downloaded file too small: ${buffer.length} bytes`);
        return url;
      }
      // Extract extension from the clean URL path
      const pathPart = downloadUrl.split("?")[0];
      const ext = pathPart.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)?.[1] || "jpg";
      const name = `${category}-${Date.now()}.${ext}`;
      const dir = join(siteDir, "public", "images", category);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, name), buffer);
      console.log(`[LocalizeImage] Saved: /images/${category}/${name} (${buffer.length} bytes)`);
      return `/images/${category}/${name}`;
    } catch (err: any) {
      console.error(`[LocalizeImage] Error:`, err.message);
      return url;
    }
  }
  return url;
}

/**
 * POST /api/websites/[id]/update-data
 * Saves edited site data to DB and rewrites data.ts with the updated content.
 * Does NOT rebuild — the caller should trigger rebuild separately.
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

    // Save to DB
    await prisma.website.update({
      where: { id },
      data: { siteData: JSON.stringify(data) },
    });

    // Rewrite data.ts in the generated site
    const siteDir = website.generatedPath || getSiteDir(id);
    const dataPath = join(siteDir, "src", "lib", "data.ts");

    try {
      let content = readFileSync(dataPath, "utf-8");

      // Update companyInfo fields
      if (data.company) {
        const c = data.company;
        content = replaceField(content, "name", c.name);
        content = replaceField(content, "shortName", c.shortName);
        content = replaceField(content, "tagline", c.tagline);
        content = replaceField(content, "description", c.description);
        content = replaceField(content, "about", c.about);
        content = replaceField(content, "mission", c.mission);
        content = replaceField(content, "address", c.address);
        content = replaceField(content, "city", c.city);
        content = replaceField(content, "state", c.state);
        content = replaceField(content, "country", c.country);
        if (c.phones?.length) content = replaceArray(content, "phones", c.phones);
        if (c.emails?.length) content = replaceArray(content, "emails", c.emails);
        if (c.website) content = replaceField(content, "website", c.website);
      }

      // Update stats
      if (data.stats) {
        for (const stat of data.stats) {
          const regex = new RegExp(`(${stat.label}):\\s*\\d+`);
          content = content.replace(regex, `${stat.label}: ${stat.value}`);
        }
      }

      // Update services titles and descriptions
      if (data.services) {
        for (const service of data.services) {
          if (service.id) {
            // Find the service block by id and update its fields
            const serviceRegex = new RegExp(
              `(id:\\s*['"]${service.id}['"][\\s\\S]*?title:\\s*['"])([\\s\\S]*?)(['"])`,
              "m"
            );
            content = content.replace(serviceRegex, `$1${escapeStr(service.title)}$3`);
          }
        }
      }

      // Update team members
      if (data.team) {
        const teamCode = data.team.map((t: { name: string; role: string; bio?: string; image?: string }) => `  {
    name: '${escapeStr(t.name)}',
    role: '${escapeStr(t.role)}',
    bio: '${escapeStr(t.bio || "")}',
    image: '${escapeStr(t.image || "")}',
  }`).join(",\n");

        // Keep the original export name (team or teamMembers)
        const teamExportMatch = content.match(/export const (teamMembers|team)\s*=/);
        const teamExportName = teamExportMatch?.[1] || "team";
        content = content.replace(
          /export const (?:teamMembers|team)\s*=\s*\[[\s\S]*?\n\]/,
          `export const ${teamExportName} = [\n${teamCode}\n]`
        );
      }

      // Update FAQ
      if (data.faq) {
        const faqCode = data.faq.map((f: { question: string; answer: string }) => `  {
    question: '${escapeStr(f.question)}',
    answer: '${escapeStr(f.answer)}',
  }`).join(",\n");

        const faqExportMatch = content.match(/export const (faqItems|faqs?)\s*=/);
        const faqExportName = faqExportMatch?.[1] || "faqItems";
        content = content.replace(
          /export const (?:faqItems|faqs?)\s*=\s*\[[\s\S]*?\n\]/,
          `export const ${faqExportName} = [\n${faqCode}\n]`
        );
      }

      // Update testimonials
      if (data.testimonials) {
        // Rebuild the testimonials array entirely
        const testimonialsCode = data.testimonials.map((t: { name: string; role: string; text: string; rating: number }) => `  {
    name: '${escapeStr(t.name)}',
    role: '${escapeStr(t.role)}',
    rating: ${t.rating || 5},
    text: '${escapeStr(t.text)}',
    avatar: '${(t.name || "").split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}',
  }`).join(",\n");

        content = content.replace(
          /export const testimonials\s*=\s*\[[\s\S]*?\n\]/,
          `export const testimonials = [\n${testimonialsCode}\n]`
        );
      }

      // Update blog posts
      if (data.blogPosts) {
        const blogCode = data.blogPosts.map((b: any) => `  {
    id: '${escapeStr(b.id || "")}',
    title: '${escapeStr(b.title)}',
    excerpt: '${escapeStr(b.excerpt || "")}',
    content: '${escapeStr(b.content || "")}',
    category: '${escapeStr(b.category || "")}',
    date: '${escapeStr(b.date || "")}',
    author: '${escapeStr(b.author || "")}',
    image: '${escapeStr(b.image || "")}',
  }`).join(",\n");

        content = content.replace(
          /export const blogPosts\s*=\s*\[[\s\S]*?\n\]/,
          `export const blogPosts = [\n${blogCode}\n]`
        );
      }

      // Update gallery images
      if (data.galleryImages) {
        const galleryCode = data.galleryImages.map((g: any) => `  {
    src: '${escapeStr(g.src || "")}',
    alt: '${escapeStr(g.alt || "")}',
    category: '${escapeStr(g.category || "")}',
  }`).join(",\n");

        content = content.replace(
          /export const galleryImages\s*=\s*\[[\s\S]*?\n\]/,
          `export const galleryImages = [\n${galleryCode}\n]`
        );
      }

      writeFileSync(dataPath, content);

      // Localize any external image URLs (download to site public dir)
      if (data.logo && data.logo.startsWith("http")) {
        data.logo = await localizeImage(data.logo, siteDir, "brand");
      }
      if (data.heroImages) {
        for (let i = 0; i < data.heroImages.length; i++) {
          if (data.heroImages[i]?.startsWith("http")) {
            data.heroImages[i] = await localizeImage(data.heroImages[i], siteDir, "hero");
          }
        }
      }
      if (data.team) {
        for (const member of data.team) {
          if (member.image?.startsWith("http")) {
            member.image = await localizeImage(member.image, siteDir, "team");
          }
        }
      }
      if (data.services) {
        for (const svc of data.services) {
          if (svc.image?.startsWith("http")) {
            svc.image = await localizeImage(svc.image, siteDir, "services");
          }
        }
      }

      // Update Hero.tsx slides if heroImages changed
      if (data.heroImages && data.heroImages.length > 0) {
        const heroPath = join(siteDir, "src", "components", "Hero.tsx");
        try {
          let heroContent = readFileSync(heroPath, "utf-8");
          const slidesCode = data.heroImages.map((img: string, i: number) => `  {\n    src: '${escapeStr(img)}',\n    alt: 'Slide ${i + 1}',\n  }`).join(",\n");
          heroContent = heroContent.replace(
            /const slides\s*=\s*\[[\s\S]*?\];/,
            `const slides = [\n${slidesCode}\n];`
          );
          writeFileSync(heroPath, heroContent);
          console.log(`[UpdateData] Updated Hero.tsx slides`);
        } catch (err) {
          console.log(`[UpdateData] Hero.tsx not found or not updatable`);
        }
      }

      // Update Header.tsx logo if logo changed
      if (data.logo) {
        const headerPath = join(siteDir, "src", "components", "Header.tsx");
        try {
          let headerContent = readFileSync(headerPath, "utf-8");

          // Case 1: Header uses <Logo /> component — replace with <img> tag
          if (headerContent.includes("<Logo") || headerContent.includes("Logo />")) {
            headerContent = headerContent.replace(/import Logo from ['"]@\/components\/Logo['"];?\n?/g, "");
            headerContent = headerContent.replace(/<Logo\s[^>]*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-8 sm:h-10 w-auto" />`);
            headerContent = headerContent.replace(/<Logo\s*\/>/g, `<img src="${escapeStr(data.logo)}" alt="Logo" className="h-8 sm:h-10 w-auto" />`);
          }
          // Case 2: Header already uses <img> for logo — replace the entire img tag's src
          else {
            // Find the logo img tag and replace its src (handles any URL including S3 presigned)
            headerContent = headerContent.replace(
              /(<img[^>]*alt=["']Logo["'][^>]*src=["'])[^"']*(["'])/i,
              `$1${escapeStr(data.logo)}$2`
            );
            // Also try src before alt
            headerContent = headerContent.replace(
              /(<img[^>]*src=["'])[^"']*(["'][^>]*alt=["']Logo["'])/i,
              `$1${escapeStr(data.logo)}$2`
            );
          }

          writeFileSync(headerPath, headerContent);
          console.log(`[UpdateData] Updated Header.tsx logo to: ${data.logo}`);
        } catch (err) {
          console.log(`[UpdateData] Header.tsx update error:`, err);
        }

        // Also update favicon in layout.tsx
        const layoutPath = join(siteDir, "src", "app", "layout.tsx");
        try {
          let layoutContent = readFileSync(layoutPath, "utf-8");
          layoutContent = layoutContent.replace(
            /href=["'][^"']*favicon[^"']*["']/g,
            `href="${escapeStr(data.logo)}"`
          );
          writeFileSync(layoutPath, layoutContent);
        } catch {}
      }

      console.log(`[UpdateData] Updated data.ts for ${website.slug}`);
    } catch (err) {
      console.error("[UpdateData] Failed to update data.ts:", err);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST update-data error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function escapeStr(s: string): string {
  return (s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n");
}

function replaceField(content: string, field: string, value: string): string {
  if (value === undefined || value === null) return content;
  const regex = new RegExp(`(${field}:\\s*['"])([\\s\\S]*?)(?:(?<!\\\\)['"])`, "m");
  return content.replace(regex, `${field}: '${escapeStr(value)}'`);
}

function replaceArray(content: string, field: string, values: string[]): string {
  const items = values.map((v) => `'${escapeStr(v)}'`).join(", ");
  const regex = new RegExp(`(${field}:\\s*)\\[[^\\]]*\\]`);
  return content.replace(regex, `${field}: [${items}]`);
}
