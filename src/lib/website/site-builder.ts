/**
 * Site Builder — handles npm install, next build, and deployment
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync, writeFileSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
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

/**
 * Sync basePath across next.config.ts, data.ts (SITE_BASE), and all image paths.
 * When custom domain is connected: basePath='' (root-relative links).
 * When no custom domain: basePath='/sites/{slug}'.
 */
function syncBasePath(siteDir: string, basePath: string, slug: string): void {
  // Update next.config.ts
  const configPath = join(siteDir, "next.config.ts");
  if (existsSync(configPath)) {
    let config = readFileSync(configPath, "utf-8");
    config = config.replace(/basePath:\s*['"][^'"]*['"]/, `basePath: '${basePath}'`);
    writeFileSync(configPath, config);
  }

  // Update SITE_BASE in data.ts
  const dataPath = join(siteDir, "src", "lib", "data.ts");
  if (existsSync(dataPath)) {
    let data = readFileSync(dataPath, "utf-8");
    data = data.replace(/export const SITE_BASE\s*=\s*['"][^'"]*['"]/, `export const SITE_BASE = '${basePath}'`);

    // Rewrite image paths
    const oldPrefix = `/sites/${slug}`;
    if (basePath === "") {
      // Custom domain: strip /sites/slug prefix from image paths
      data = data.replace(new RegExp(escapeRegex(oldPrefix) + "(/images/)", "g"), "$1");
    } else if (!data.includes(`${basePath}/images/`)) {
      // No custom domain: ensure /images/ paths have the basePath prefix
      // Only prefix bare /images/ that aren't already prefixed
      data = data.replace(/(?<=["'])\/images\//g, `${basePath}/images/`);
    }
    writeFileSync(dataPath, data);
  }

  // Rewrite image paths in all component/page files
  const srcDir = join(siteDir, "src");
  const oldPrefix = `/sites/${slug}`;
  if (basePath === "" && slug) {
    const files = collectSourceFiles(srcDir);
    const pattern = new RegExp(escapeRegex(oldPrefix) + "(/images/)", "g");
    for (const file of files) {
      let content = readFileSync(file, "utf-8");
      const updated = content.replace(pattern, "$1");
      if (updated !== content) writeFileSync(file, updated);
    }
  }

  console.log(`[SiteBuilder] Synced basePath to '${basePath}' for slug '${slug}'`);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recursively collect all .ts/.tsx files in a directory
 */
function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
      collectSourceFiles(full, files);
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Pre-build validation: scan all source files for @/ imports that don't resolve.
 * Auto-creates minimal stub files for missing modules so the build doesn't crash.
 * Returns the list of stubs created.
 */
function validateAndFixImports(siteDir: string): string[] {
  const srcDir = join(siteDir, "src");
  const files = collectSourceFiles(srcDir);
  const createdStubs: string[] = [];

  // Collect all @/ imports across all files
  const missingImports = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    // Match: import ... from '@/...' or import ... from "@/..."
    const importRegex = /from\s+['"]@\/([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]; // e.g. "components/Header" or "lib/data"
      const resolvedBase = join(srcDir, importPath);

      // Check if it resolves (with or without extensions)
      const candidates = [
        resolvedBase,
        resolvedBase + ".ts",
        resolvedBase + ".tsx",
        resolvedBase + ".js",
        resolvedBase + ".jsx",
        join(resolvedBase, "index.ts"),
        join(resolvedBase, "index.tsx"),
      ];

      if (!candidates.some(c => existsSync(c))) {
        missingImports.add(importPath);
      }
    }
  }

  // Create stub files for missing imports
  for (const importPath of missingImports) {
    const isComponent = importPath.startsWith("components/");
    const componentName = importPath.split("/").pop() || "Unknown";

    // Determine file extension based on path
    const ext = isComponent ? ".tsx" : ".ts";
    const stubPath = join(srcDir, importPath + ext);

    mkdirSync(dirname(stubPath), { recursive: true });

    if (isComponent) {
      // Create a minimal React component stub
      const stub = `"use client";

export default function ${componentName}(props: Record<string, unknown>) {
  return <div data-component="${componentName}" />;
}
`;
      writeFileSync(stubPath, stub, "utf-8");
    } else {
      // Create a minimal data/util stub with empty exports
      writeFileSync(stubPath, `// Auto-generated stub for missing module: ${importPath}\nexport default {};\n`, "utf-8");
    }

    createdStubs.push(importPath);
    console.log(`[SiteBuilder] Created stub for missing import: @/${importPath}`);
  }

  return createdStubs;
}

/**
 * Fix common syntax errors in generated data.ts
 * - Unescaped single quotes inside single-quoted strings
 */
function fixDataSyntax(siteDir: string): void {
  const dataPath = join(siteDir, "src", "lib", "data.ts");
  if (!existsSync(dataPath)) return;

  let content = readFileSync(dataPath, "utf-8");
  const original = content;

  // Fix single-quoted strings that contain unescaped apostrophes
  // Match: 'text with unescaped ' inside'  →  "text with unescaped ' inside"
  // Strategy: find lines with odd number of single quotes (broken strings) and switch to double quotes
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Count unescaped single quotes
    const unescaped = line.replace(/\\'/g, "").match(/'/g);
    if (unescaped && unescaped.length % 2 !== 0) {
      // Odd number of single quotes — broken string. Convert to double quotes.
      // Replace the first and last single quote with double quotes
      const firstQ = line.indexOf("'");
      const lastQ = line.lastIndexOf("'");
      if (firstQ !== lastQ && firstQ >= 0) {
        const before = line.substring(0, firstQ);
        const middle = line.substring(firstQ + 1, lastQ).replace(/\\'/g, "'"); // unescape existing
        const after = line.substring(lastQ + 1);
        // Escape any double quotes in the middle
        const escaped = middle.replace(/"/g, '\\"');
        lines[i] = `${before}"${escaped}"${after}`;
      }
    }
  }
  content = lines.join("\n");

  if (content !== original) {
    writeFileSync(dataPath, content, "utf-8");
    console.log("[SiteBuilder] Auto-fixed data.ts syntax (unescaped quotes)");
  }
}

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
    const hasCustomDomain = !!website?.customDomain;
    const basePath = hasCustomDomain ? "" : `/sites/${website?.slug || websiteId}`;

    // Update build status
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "building" },
    });

    // Sync basePath in next.config.ts and SITE_BASE in data.ts
    syncBasePath(siteDir, basePath, website?.slug || "");

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
