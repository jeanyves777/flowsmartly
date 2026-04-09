/**
 * Site Builder — handles npm install, next build, and deployment
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import {
  TEMPLATE_PACKAGE_JSON,
  TEMPLATE_TSCONFIG,
  TEMPLATE_POSTCSS_CONFIG,
  TEMPLATE_TAILWIND_CONFIG,
  TEMPLATE_THEME_PROVIDER,
  TEMPLATE_THEME_TOGGLE,
  TEMPLATE_COOKIE_CONSENT,
  getTrackingScript,
} from "./templates";
import {
  syncBasePath,
  validateAndFixImports,
  fixDataSyntax,
  fixBareLinks,
  fixHamburgerMenu,
  injectAnalytics,
  fixGenerateStaticParams,
} from "@/lib/build-utils/validators";

// Directories
const SITES_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\generated-sites"
  : "/var/www/flowsmartly/generated-sites";

const OUTPUT_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\sites-output"
  : "/var/www/flowsmartly/sites-output";

/**
 * Get the directory path for a website's source files
 */
export function getSiteDir(websiteId: string): string {
  return join(SITES_BASE, websiteId);
}

/**
 * Get the output directory for a website's static files
 */
export function getOutputDir(slug: string): string {
  return join(OUTPUT_BASE, slug);
}

/**
 * Initialize a new site directory with template files
 */
export function initSiteDir(websiteId: string, slug: string): string {
  const siteDir = getSiteDir(websiteId);

  // Create directory structure
  const dirs = [
    siteDir,
    join(siteDir, "src", "app"),
    join(siteDir, "src", "components"),
    join(siteDir, "src", "lib"),
    join(siteDir, "public", "images", "hero"),
    join(siteDir, "public", "images", "services"),
    join(siteDir, "public", "images", "team"),
    join(siteDir, "public", "images", "gallery"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  // Write template files
  writeFileSync(join(siteDir, "package.json"), TEMPLATE_PACKAGE_JSON);
  writeFileSync(join(siteDir, "tsconfig.json"), TEMPLATE_TSCONFIG);
  // next.config.ts with basePath for correct asset paths under /sites/{slug}
  writeFileSync(join(siteDir, "next.config.ts"), `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/sites/${slug}',
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
`);
  writeFileSync(join(siteDir, "postcss.config.mjs"), TEMPLATE_POSTCSS_CONFIG);
  // Tailwind v4 — no tailwind.config.ts needed (CSS-based config via @import "tailwindcss")
  writeFileSync(join(siteDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(siteDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);

  // Tracking script + cookie consent
  const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  writeFileSync(join(siteDir, "src", "components", "Analytics.tsx"), getTrackingScript(websiteId, apiBaseUrl));
  writeFileSync(join(siteDir, "src", "components", "CookieConsent.tsx"), TEMPLATE_COOKIE_CONSENT);

  // Create directories for legal pages (agent writes the actual content)
  mkdirSync(join(siteDir, "src", "app", "privacy-policy"), { recursive: true });
  mkdirSync(join(siteDir, "src", "app", "cookie-policy"), { recursive: true });
  mkdirSync(join(siteDir, "src", "app", "terms"), { recursive: true });

  return siteDir;
}

/**
 * Write a file to the site directory (used by the agent)
 */
export function writeSiteFile(websiteId: string, relativePath: string, content: string): void {
  const siteDir = getSiteDir(websiteId);
  const fullPath = join(siteDir, relativePath);

  // Security: ensure path stays within site directory
  if (!fullPath.startsWith(siteDir)) {
    throw new Error(`Path ${relativePath} is outside site directory`);
  }

  // Create parent directories
  const dir = fullPath.substring(0, fullPath.lastIndexOf(process.platform === "win32" ? "\\" : "/"));
  mkdirSync(dir, { recursive: true });

  writeFileSync(fullPath, content, "utf-8");
}

// Pre-build validators are now imported from @/lib/build-utils/validators

/**
 * Build the site (npm install + next build)
 */
export async function buildSite(websiteId: string): Promise<{ success: boolean; output: string; error?: string }> {
  const siteDir = getSiteDir(websiteId);

  if (!existsSync(siteDir)) {
    return { success: false, output: "", error: "Site directory not found" };
  }

  try {
    // Fetch website to check for custom domain
    const website = await prisma.website.findUnique({
      where: { id: websiteId },
      select: { slug: true, customDomain: true },
    });
    // Always use /sites/{slug} basePath — custom domain routing is handled by
    // the middleware rewrite, not by changing basePath. This keeps preview working
    // on flowsmartly.com and custom domain serving working simultaneously.
    const basePath = `/sites/${website?.slug || websiteId}`;

    // Update build status
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "building" },
    });

    // Sync basePath in next.config.ts and SITE_BASE in data.ts
    syncBasePath(siteDir, basePath, website?.slug || "", "SITE_BASE", "src/lib/data.ts");

    // npm install — only if node_modules doesn't exist
    let installOutput = "";
    const nodeModulesExists = existsSync(join(siteDir, "node_modules", "next"));
    if (!nodeModulesExists) {
      console.log(`[SiteBuilder] Installing dependencies for ${websiteId}...`);
      installOutput = execSync("npm install --include=dev", {
        cwd: siteDir,
        timeout: 120000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
      });
    } else {
      console.log(`[SiteBuilder] Dependencies already installed, skipping npm install`);
    }

    // Pre-build: validate imports and create stubs for missing ones
    const stubs = validateAndFixImports(siteDir);
    if (stubs.length > 0) {
      console.log(`[SiteBuilder] Auto-fixed ${stubs.length} missing imports: ${stubs.join(", ")}`);
    }

    // Pre-build: fix common data.ts syntax issues (unescaped quotes in strings)
    fixDataSyntax(siteDir);

    // Pre-build: fix bare internal links that are missing the basePath prefix
    fixBareLinks(siteDir, basePath);

    // Pre-build: fix hamburger menu animation (AnimatePresence breaks on static export)
    fixHamburgerMenu(siteDir);

    // Pre-build: inject Analytics + CookieConsent into layout.tsx if missing
    injectAnalytics(siteDir);

    // Pre-build: auto-split "use client" + generateStaticParams conflicts
    fixGenerateStaticParams(siteDir);

    // Clear build cache so changes are picked up
    const nextCacheDir = join(siteDir, ".next");
    try { const { rmSync } = await import("fs"); rmSync(nextCacheDir, { recursive: true, force: true }); } catch {}

    // next build (static export)
    console.log(`[SiteBuilder] Building site ${websiteId}...`);
    const buildOutput = execSync("npx next build", {
      cwd: siteDir,
      timeout: 180000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

    // Update build status
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null },
    });

    return { success: true, output: installOutput + "\n" + buildOutput };
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    console.error(`[SiteBuilder] Build failed for ${websiteId}:`, errorMsg.substring(0, 500));

    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "error", lastBuildError: errorMsg.substring(0, 2000) },
    });

    return { success: false, output: "", error: errorMsg };
  }
}

/**
 * Deploy built site (copy out/ to nginx output directory)
 */
export async function deploySite(websiteId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const siteDir = getSiteDir(websiteId);
  const outDir = join(siteDir, "out");
  const outputDir = getOutputDir(slug);

  if (!existsSync(outDir)) {
    return { success: false, error: "Build output not found. Run build first." };
  }

  try {
    // Create output directory
    mkdirSync(OUTPUT_BASE, { recursive: true });

    // Remove old output, then copy fresh build
    const { rmSync } = await import("fs");
    try { rmSync(outputDir, { recursive: true, force: true }); } catch {}
    cpSync(outDir, outputDir, { recursive: true, force: true });

    // Update website status
    await prisma.website.update({
      where: { id: websiteId },
      data: { status: "PUBLISHED", publishedAt: new Date(), publishedVersion: { increment: 1 } },
    });

    console.log(`[SiteBuilder] Deployed ${websiteId} to ${outputDir}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[SiteBuilder] Deploy failed:`, err.message);
    return { success: false, error: err.message };
  }
}
