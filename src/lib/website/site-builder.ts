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
  TEMPLATE_NEXT_CONFIG,
  TEMPLATE_POSTCSS_CONFIG,
  TEMPLATE_TAILWIND_CONFIG,
  TEMPLATE_THEME_PROVIDER,
  TEMPLATE_THEME_TOGGLE,
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
export function initSiteDir(websiteId: string): string {
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
  writeFileSync(join(siteDir, "next.config.ts"), TEMPLATE_NEXT_CONFIG);
  writeFileSync(join(siteDir, "postcss.config.mjs"), TEMPLATE_POSTCSS_CONFIG);
  writeFileSync(join(siteDir, "tailwind.config.ts"), TEMPLATE_TAILWIND_CONFIG);
  writeFileSync(join(siteDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(siteDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);

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
 * Build the site (npm install + next build)
 */
export async function buildSite(websiteId: string): Promise<{ success: boolean; output: string; error?: string }> {
  const siteDir = getSiteDir(websiteId);

  if (!existsSync(siteDir)) {
    return { success: false, output: "", error: "Site directory not found" };
  }

  try {
    // Update build status
    await prisma.website.update({
      where: { id: websiteId },
      data: { buildStatus: "building" },
    });

    // npm install
    console.log(`[SiteBuilder] Installing dependencies for ${websiteId}...`);
    const installOutput = execSync("npm install", {
      cwd: siteDir,
      timeout: 120000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

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

    // Copy out/ to output dir (overwrite if exists)
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
