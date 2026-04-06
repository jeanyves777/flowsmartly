import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { buildSite, deploySite, getSiteDir } from "@/lib/website/site-builder";

/**
 * POST /api/websites/[id]/fix-links
 * Rewrites all internal links in the generated site to use the correct basePath,
 * then rebuilds and deploys. No credit charge — this is a fix, not a generation.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const website = await prisma.website.findFirst({
      where: { id, userId: session.userId, deletedAt: null },
      select: { id: true, slug: true, generatedPath: true },
    });
    if (!website) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const siteDir = website.generatedPath || getSiteDir(id);
    const basePath = `/sites/${website.slug}`;

    // 1. Add siteUrl helper to data.ts if not already there
    const dataPath = join(siteDir, "src", "lib", "data.ts");
    try {
      let dataContent = readFileSync(dataPath, "utf-8");
      if (!dataContent.includes("SITE_BASE")) {
        // Add siteUrl helper at the top (after imports)
        const helper = `\n// Site base path for internal links\nexport const SITE_BASE = "${basePath}";\nexport function siteUrl(path: string): string { return SITE_BASE + path; }\n`;
        dataContent = dataContent.replace(/^(["']use .*?["'];?\n)?/, "$1" + helper);
        writeFileSync(dataPath, dataContent);
      }

      // Fix navLinks hrefs in data.ts
      dataContent = readFileSync(dataPath, "utf-8");
      // Replace href: '/about' → href: '/sites/{slug}/about' (but not already-fixed ones)
      dataContent = dataContent.replace(
        /href:\s*['"]\/(?!sites\/|http|mailto|tel)([^'"]*)['"]/g,
        `href: '${basePath}/$1'`
      );
      // Fix href: '/' → href: '/sites/{slug}'
      dataContent = dataContent.replace(
        new RegExp(`href:\\s*['"]\\/${basePath.replace(/\//g, "\\/")}`, "g"),
        `href: '${basePath}`
      );
      writeFileSync(dataPath, dataContent);
    } catch (err) {
      console.log("[FixLinks] data.ts not found or not fixable, continuing...");
    }

    // 2. Fix all href="/..." links in .tsx files (except external, images, _next)
    const srcDir = join(siteDir, "src");
    const tsxFiles = getAllFiles(srcDir, ".tsx");

    for (const file of tsxFiles) {
      let content = readFileSync(file, "utf-8");
      let changed = false;

      // Replace href="/about" → href="/sites/{slug}/about"
      // But NOT href="/sites/...", href="http...", href="mailto:...", href="tel:..."
      const newContent = content.replace(
        /href=["']\/(?!sites\/|_next\/|http|mailto:|tel:|#)([^"']*)["']/g,
        (match, path) => {
          changed = true;
          return `href="${basePath}/${path}"`;
        }
      );

      // Also fix Link href props
      const newContent2 = newContent.replace(
        /href=\{["']\/(?!sites\/|images\/|_next\/|http|mailto:|tel:|#)([^"']*?)["']\}/g,
        (match, path) => {
          changed = true;
          return `href={"${basePath}/${path}"}`;
        }
      );

      if (changed) {
        // Fix double slashes that might occur
        const cleaned = newContent2.replace(new RegExp(`${basePath}//`, "g"), `${basePath}/`);
        writeFileSync(file, cleaned);
      }
    }

    // 3. Fix image src="/images/..." → src="/sites/{slug}/images/..."
    for (const file of tsxFiles) {
      let content = readFileSync(file, "utf-8");
      let changed = false;

      // Fix src="/images/..." (not already prefixed with /sites/)
      const fixedContent = content.replace(
        /src=["']\/(?!sites\/)images\/([^"']*)["']/g,
        (match, path) => {
          changed = true;
          return `src="${basePath}/images/${path}"`;
        }
      );

      // Fix image: '/images/...' in data files
      const fixedContent2 = fixedContent.replace(
        /:\s*['"]\/(?!sites\/)images\/([^'"]*)['"]/g,
        (match, path) => {
          changed = true;
          return `: '${basePath}/images/${path}'`;
        }
      );

      if (changed) {
        writeFileSync(file, fixedContent2);
      }
    }

    // 4. Also replace any <Link from 'next/link'> with regular <a> tags
    // (static export works better with <a> tags)
    for (const file of tsxFiles) {
      let content = readFileSync(file, "utf-8");
      if (content.includes("from 'next/link'") || content.includes('from "next/link"')) {
        content = content
          .replace(/import\s+Link\s+from\s+['"]next\/link['"];?\n?/g, "")
          .replace(/<Link\s/g, "<a ")
          .replace(/<\/Link>/g, "</a>");
        writeFileSync(file, content);
      }
    }

    console.log(`[FixLinks] Fixed links in ${tsxFiles.length} files for ${website.slug}`);

    // 4. Rebuild and deploy (fire-and-forget for speed)
    (async () => {
      const buildResult = await buildSite(id);
      if (buildResult.success) {
        await deploySite(id, website.slug);
        console.log(`[FixLinks] Rebuilt and deployed ${website.slug}`);
      } else {
        console.error(`[FixLinks] Build failed:`, buildResult.error?.substring(0, 200));
      }
    })().catch(console.error);

    return NextResponse.json({ success: true, message: "Links fixed, rebuild started" });
  } catch (err) {
    console.error("Fix links error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Recursively get all files with a given extension
function getAllFiles(dir: string, ext: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        const stat = statSync(full);
        if (stat.isDirectory() && entry !== "node_modules" && entry !== ".next") {
          files.push(...getAllFiles(full, ext));
        } else if (entry.endsWith(ext)) {
          files.push(full);
        }
      } catch {}
    }
  } catch {}
  return files;
}
