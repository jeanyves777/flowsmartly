/**
 * Site Builder — handles npm install, next build, and deployment.
 *
 * V2: Static export → nginx static files
 * V3: Independent SSR app → PM2 process + nginx reverse proxy
 */

import { execSync, spawn as spawnProcess } from "child_process";
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
  TEMPLATE_SSR_NEXT_CONFIG,
  TEMPLATE_WEBSITE_API_CLIENT,
  TEMPLATE_WEBSITE_API_PROXY,
  getWebsiteEnvLocal,
  getWebsiteSSRTrackingScript,
} from "./templates/ssr-templates";
import {
  syncBasePath,
  validateAndFixImports,
  fixDataSyntax,
  fixBareLinks,
  fixHamburgerMenu,
  injectAnalytics,
  fixGenerateStaticParams,
  cleanupV3Patterns,
  fixTailwindV4Classes,
  fixGlobalsCss,
  fixUseSearchParams,
} from "@/lib/build-utils/validators";
import {
  allocatePort,
  startApp,
  stopApp,
  deleteApp,
  waitForHealthy,
  getActiveAppCount,
  MAX_CONCURRENT_APPS,
} from "@/lib/ssr-manager";
import { regenerateAndReload } from "@/lib/ssr-manager/nginx-config";

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

/** Non-blocking command execution for long-running builds */
function execAsync(cmd: string, options: { cwd: string; env?: NodeJS.ProcessEnv; timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const [bin, ...args] = cmd.split(" ");
    const child = spawnProcess(bin, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });
    let stdout = "", stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    const timer = options.timeout ? setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Command timed out")); }, options.timeout) : null;
    child.on("close", (code) => { if (timer) clearTimeout(timer); if (code === 0) resolve(stdout); else reject(Object.assign(new Error(`Command failed with code ${code}`), { stdout, stderr })); });
    child.on("error", (err) => { if (timer) clearTimeout(timer); reject(err); });
  });
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

// ═════════════════════════════════════════════════════════════════════════════
// V3: Independent SSR Website App (fully self-hostable)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Initialize a V3 SSR website directory.
 * Writes all template files that are identical for every website:
 * - next.config.ts (SSR, no export, no basePath)
 * - api-client.ts (gateway client for forms, analytics)
 * - API proxy route (catch-all forwarding)
 * - .env.local (API_GATEWAY_URL, WEBSITE_ID, WEBSITE_SLUG)
 * - Analytics, CookieConsent, ThemeProvider, ThemeToggle
 */
export function initSiteDirV3(websiteId: string, slug: string): string {
  const siteDir = getSiteDir(websiteId);

  const dirs = [
    siteDir,
    join(siteDir, "src", "app"),
    join(siteDir, "src", "app", "about"),
    join(siteDir, "src", "app", "services"),
    join(siteDir, "src", "app", "contact"),
    join(siteDir, "src", "app", "blog"),
    join(siteDir, "src", "app", "gallery"),
    join(siteDir, "src", "app", "team"),
    join(siteDir, "src", "app", "faq"),
    join(siteDir, "src", "app", "privacy-policy"),
    join(siteDir, "src", "app", "cookie-policy"),
    join(siteDir, "src", "app", "terms"),
    join(siteDir, "src", "app", "api", "[...path]"),
    join(siteDir, "src", "components"),
    join(siteDir, "src", "lib"),
    join(siteDir, "public", "images", "hero"),
    join(siteDir, "public", "images", "services"),
    join(siteDir, "public", "images", "team"),
    join(siteDir, "public", "images", "gallery"),
    join(siteDir, "public", "images", "brand"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  // Identical template files
  writeFileSync(join(siteDir, "package.json"), TEMPLATE_PACKAGE_JSON);
  writeFileSync(join(siteDir, "tsconfig.json"), TEMPLATE_TSCONFIG);
  writeFileSync(join(siteDir, "next.config.ts"), TEMPLATE_SSR_NEXT_CONFIG);
  writeFileSync(join(siteDir, "postcss.config.mjs"), TEMPLATE_POSTCSS_CONFIG);

  // Environment config
  const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  writeFileSync(join(siteDir, ".env.local"), getWebsiteEnvLocal(websiteId, slug, apiBaseUrl));

  // API gateway client + proxy
  writeFileSync(join(siteDir, "src", "lib", "api-client.ts"), TEMPLATE_WEBSITE_API_CLIENT);
  writeFileSync(join(siteDir, "src", "app", "api", "[...path]", "route.ts"), TEMPLATE_WEBSITE_API_PROXY);

  // Theme + UI templates
  writeFileSync(join(siteDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(siteDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);
  writeFileSync(join(siteDir, "src", "components", "Analytics.tsx"), getWebsiteSSRTrackingScript(websiteId));
  writeFileSync(join(siteDir, "src", "components", "CookieConsent.tsx"), TEMPLATE_COOKIE_CONSENT);

  // Pages Router fallback — Next.js 15 needs these for internal prerender
  mkdirSync(join(siteDir, "src", "pages"), { recursive: true });
  writeFileSync(join(siteDir, "src", "pages", "_error.tsx"), `export default function Error() { return null; }\n`);
  writeFileSync(join(siteDir, "src", "pages", "_document.tsx"), `import { Html, Head, Main, NextScript } from "next/document";\nexport default function Document() { return <Html><Head /><body><Main /><NextScript /></body></Html>; }\n`);

  return siteDir;
}

/**
 * Build a V3 SSR website (next build without static export).
 */
export async function buildSiteV3(websiteId: string): Promise<{ success: boolean; output: string; error?: string }> {
  const siteDir = getSiteDir(websiteId);

  if (!existsSync(siteDir)) {
    return { success: false, output: "", error: "Site directory not found" };
  }

  try {
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "building" },
    });

    // npm install
    let installOutput = "";
    if (!existsSync(join(siteDir, "node_modules", "next"))) {
      console.log(`[SiteBuilder:V3] Installing dependencies for ${websiteId}...`);
      installOutput = await execAsync("npm install --include=dev", {
        cwd: siteDir,
        timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
      });
    }

    // SSR-applicable validators only
    cleanupV3Patterns(siteDir);
    fixTailwindV4Classes(siteDir);
    fixGlobalsCss(siteDir);
    fixUseSearchParams(siteDir);
    const stubs = validateAndFixImports(siteDir);
    if (stubs.length > 0) {
      console.log(`[SiteBuilder:V3] Auto-fixed ${stubs.length} missing imports: ${stubs.join(", ")}`);
    }
    fixDataSyntax(siteDir);
    fixHamburgerMenu(siteDir);
    injectAnalytics(siteDir);

    // Clear cache
    try { const { rmSync } = await import("fs"); rmSync(join(siteDir, ".next"), { recursive: true, force: true }); } catch {}

    // next build (SSR — NON-BLOCKING so main app stays responsive)
    console.log(`[SiteBuilder:V3] Building SSR website ${websiteId}...`);
    const buildOutput = await execAsync("npx next build", {
      cwd: siteDir,
      timeout: 300000,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null },
    });

    return { success: true, output: installOutput + "\n" + buildOutput };
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    console.error(`[SiteBuilder:V3] Build failed for ${websiteId}:`, errorMsg.substring(0, 500));

    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "error", lastBuildError: errorMsg.substring(0, 2000) },
    });

    return { success: false, output: "", error: errorMsg };
  }
}

/**
 * Deploy a V3 SSR website — start PM2 process + nginx reverse proxy.
 */
export async function deploySiteV3(websiteId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const siteDir = getSiteDir(websiteId);

  if (!existsSync(join(siteDir, ".next"))) {
    return { success: false, error: "Build output not found (.next/). Run buildSiteV3 first." };
  }

  try {
    const activeCount = await getActiveAppCount();
    if (activeCount >= MAX_CONCURRENT_APPS) {
      return { success: false, error: `Max concurrent apps reached (${MAX_CONCURRENT_APPS}).` };
    }

    const port = await allocatePort("website");
    const processName = `site-${slug}`;

    await prisma.website.update({
      where: { id: websiteId },
      data: {
        ssrPort: port,
        ssrProcessName: processName,
        ssrStatus: "starting",
        generatorVersion: "v3",
        generatedPath: siteDir,
        status: "PUBLISHED",
        publishedAt: new Date(),
        publishedVersion: { increment: 1 },
      },
    });

    console.log(`[SiteBuilder:V3] Starting ${processName} on port ${port}...`);
    await startApp({
      name: processName,
      cwd: siteDir,
      port,
      slug,
    });

    const healthy = await waitForHealthy(port, 30_000);

    await prisma.website.update({
      where: { id: websiteId },
      data: { ssrStatus: healthy ? "running" : "starting" },
    });

    await regenerateAndReload();

    console.log(`[SiteBuilder:V3] Deployed website ${websiteId} as ${processName} on port ${port}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[SiteBuilder:V3] Deploy failed:`, err.message);
    await prisma.website.update({
      where: { id: websiteId },
      data: { ssrStatus: "error" },
    });
    return { success: false, error: err.message };
  }
}

/**
 * Stop a V3 SSR website process.
 */
export async function stopSiteV3(websiteId: string): Promise<void> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { ssrProcessName: true },
  });

  if (website?.ssrProcessName) {
    await stopApp(website.ssrProcessName);
  }

  await prisma.website.update({
    where: { id: websiteId },
    data: { ssrStatus: "stopped" },
  });

  await regenerateAndReload();
}

/**
 * Restart a V3 SSR website (rebuild + redeploy).
 */
export async function restartSiteV3(websiteId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const website = await prisma.website.findUnique({
    where: { id: websiteId },
    select: { ssrProcessName: true },
  });

  if (website?.ssrProcessName) {
    await deleteApp(website.ssrProcessName);
  }

  const buildResult = await buildSiteV3(websiteId);
  if (!buildResult.success) {
    return { success: false, error: buildResult.error };
  }

  return deploySiteV3(websiteId, slug);
}
