/**
 * Store Site Builder — handles npm install, next build, and deployment
 * for agent-generated store sites (V2 static stores).
 *
 * Mirrors src/lib/website/site-builder.ts but for e-commerce stores.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, cpSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import {
  TEMPLATE_STORE_PACKAGE_JSON,
  TEMPLATE_STORE_TSCONFIG,
  TEMPLATE_STORE_POSTCSS_CONFIG,
  TEMPLATE_STORE_COOKIE_CONSENT,
  TEMPLATE_THEME_PROVIDER,
  TEMPLATE_THEME_TOGGLE,
  getStoreTrackingScript,
} from "./templates";
import {
  syncBasePath,
  validateAndFixImports,
  fixDataSyntax,
  fixBareLinks,
  fixHamburgerMenu,
  injectAnalytics,
  fixProductImages,
  fixGenerateStaticParams,
} from "@/lib/build-utils/validators";

// ─── Directories ─────────────────────────────────────────────────────────────

const STORES_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\generated-stores"
  : "/var/www/flowsmartly/generated-stores";

const OUTPUT_BASE = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\flowsmartly\\stores-output"
  : "/var/www/flowsmartly/stores-output";

export function getStoreDir(storeId: string): string {
  return join(STORES_BASE, storeId);
}

export function getStoreOutputDir(slug: string): string {
  return join(OUTPUT_BASE, slug);
}

// ─── Initialize store directory ──────────────────────────────────────────────

export function initStoreDir(storeId: string, slug: string): string {
  const storeDir = getStoreDir(storeId);

  // Create directory structure
  const dirs = [
    storeDir,
    join(storeDir, "src", "app"),
    join(storeDir, "src", "app", "products"),
    join(storeDir, "src", "app", "products", "[slug]"),
    join(storeDir, "src", "app", "category", "[slug]"),
    join(storeDir, "src", "app", "about"),
    join(storeDir, "src", "app", "faq"),
    join(storeDir, "src", "app", "shipping-policy"),
    join(storeDir, "src", "app", "return-policy"),
    join(storeDir, "src", "app", "privacy-policy"),
    join(storeDir, "src", "app", "terms"),
    join(storeDir, "src", "components"),
    join(storeDir, "src", "lib"),
    join(storeDir, "public", "images", "products"),
    join(storeDir, "public", "images", "brand"),
    join(storeDir, "public", "images", "hero"),
    join(storeDir, "public", "images", "categories"),
  ];

  for (const dir of dirs) {
    mkdirSync(dir, { recursive: true });
  }

  // Write template files
  writeFileSync(join(storeDir, "package.json"), TEMPLATE_STORE_PACKAGE_JSON);
  writeFileSync(join(storeDir, "tsconfig.json"), TEMPLATE_STORE_TSCONFIG);

  // next.config.ts with basePath for correct asset paths under /stores/{slug}
  writeFileSync(join(storeDir, "next.config.ts"), `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/stores/${slug}',
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
`);

  writeFileSync(join(storeDir, "postcss.config.mjs"), TEMPLATE_STORE_POSTCSS_CONFIG);

  // Theme provider + toggle
  writeFileSync(join(storeDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(storeDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);

  // Analytics + Cookie consent
  const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  writeFileSync(join(storeDir, "src", "components", "Analytics.tsx"), getStoreTrackingScript(storeId, apiBaseUrl));
  writeFileSync(join(storeDir, "src", "components", "CookieConsent.tsx"), TEMPLATE_STORE_COOKIE_CONSENT);

  return storeDir;
}

// ─── Write file to store directory ───────────────────────────────────────────

export function writeStoreFile(storeId: string, relativePath: string, content: string): void {
  const storeDir = getStoreDir(storeId);
  const fullPath = join(storeDir, relativePath);

  // Security: path traversal check
  if (!fullPath.startsWith(storeDir)) {
    throw new Error(`Path ${relativePath} is outside store directory`);
  }

  // Create parent directories
  const dir = fullPath.substring(0, fullPath.lastIndexOf(process.platform === "win32" ? "\\" : "/"));
  mkdirSync(dir, { recursive: true });

  writeFileSync(fullPath, content, "utf-8");
}

// ─── Build store (npm install + validators + next build) ─────────────────────

export async function buildStore(storeId: string): Promise<{ success: boolean; output: string; error?: string }> {
  const storeDir = getStoreDir(storeId);

  if (!existsSync(storeDir)) {
    return { success: false, output: "", error: "Store directory not found" };
  }

  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { slug: true, customDomain: true },
    });

    // Always /stores/{slug} — custom domain handled by middleware rewrite
    const basePath = `/stores/${store?.slug || storeId}`;

    // Update build status
    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "building" },
    });

    // 1. Sync basePath in next.config.ts and STORE_BASE in data.ts
    syncBasePath(storeDir, basePath, store?.slug || "", "STORE_BASE", "src/lib/data.ts");

    // 2. npm install — only if node_modules doesn't exist
    let installOutput = "";
    const nodeModulesExists = existsSync(join(storeDir, "node_modules", "next"));
    if (!nodeModulesExists) {
      console.log(`[StoreBuilder] Installing dependencies for ${storeId}...`);
      installOutput = execSync("npm install --include=dev", {
        cwd: storeDir,
        timeout: 120000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
      });
    } else {
      console.log(`[StoreBuilder] Dependencies already installed, skipping npm install`);
    }

    // 3. Pre-build validators (shared with website builder)
    const stubs = validateAndFixImports(storeDir);
    if (stubs.length > 0) {
      console.log(`[StoreBuilder] Auto-fixed ${stubs.length} missing imports: ${stubs.join(", ")}`);
    }

    fixDataSyntax(storeDir, "src/lib/data.ts");
    fixDataSyntax(storeDir, "src/lib/products.ts"); // Also fix products file
    fixBareLinks(storeDir, basePath);
    fixHamburgerMenu(storeDir);
    injectAnalytics(storeDir);
    fixProductImages(storeDir, basePath); // Store-specific: fix product image paths
    fixGenerateStaticParams(storeDir); // Auto-split "use client" + generateStaticParams

    // Clear build cache
    const nextCacheDir = join(storeDir, ".next");
    try { const { rmSync } = await import("fs"); rmSync(nextCacheDir, { recursive: true, force: true }); } catch {}

    // 4. next build (static export)
    console.log(`[StoreBuilder] Building store ${storeId}...`);
    const buildOutput = execSync("npx next build", {
      cwd: storeDir,
      timeout: 180000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

    // Update status
    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null },
    });

    return { success: true, output: installOutput + "\n" + buildOutput };
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    console.error(`[StoreBuilder] Build failed for ${storeId}:`, errorMsg.substring(0, 500));

    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "error", lastBuildError: errorMsg.substring(0, 2000) },
    });

    return { success: false, output: "", error: errorMsg };
  }
}

// ─── Deploy store (copy out/ to nginx output directory) ──────────────────────

export async function deployStore(storeId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const storeDir = getStoreDir(storeId);
  const outDir = join(storeDir, "out");
  const outputDir = getStoreOutputDir(slug);

  if (!existsSync(outDir)) {
    return { success: false, error: "Build output not found. Run build first." };
  }

  try {
    mkdirSync(OUTPUT_BASE, { recursive: true });

    // Remove old output, copy fresh build
    const { rmSync } = await import("fs");
    try { rmSync(outputDir, { recursive: true, force: true }); } catch {}
    cpSync(outDir, outputDir, { recursive: true, force: true });

    // Update store status
    await prisma.store.update({
      where: { id: storeId },
      data: {
        storeVersion: "static",
        generatorVersion: "v2",
        generatedPath: storeDir,
        isActive: true,
        setupComplete: true,
      },
    });

    console.log(`[StoreBuilder] Deployed store ${storeId} to ${outputDir}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[StoreBuilder] Deploy failed:`, err.message);
    return { success: false, error: err.message };
  }
}
