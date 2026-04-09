/**
 * Store Site Builder — handles npm install, next build, and deployment
 * for agent-generated store sites.
 *
 * V2: Static export → nginx static files
 * V3: Independent SSR app → PM2 process + nginx reverse proxy
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
  TEMPLATE_SSR_NEXT_CONFIG,
  TEMPLATE_API_CLIENT,
  TEMPLATE_API_PROXY,
  TEMPLATE_SSR_CART,
  getEnvLocal,
  getSSRTrackingScript,
} from "./templates/ssr-templates";
import {
  syncBasePath,
  validateAndFixImports,
  fixDataSyntax,
  fixBareLinks,
  fixHamburgerMenu,
  injectAnalytics,
  fixProductImages,
  fixGenerateStaticParams,
  cleanupV3Patterns,
  fixTailwindV4Classes,
  fixGlobalsCss,
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

// ═════════════════════════════════════════════════════════════════════════════
// V3: Independent SSR App (fully self-hostable)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Initialize a V3 SSR store directory.
 * Writes all template files that are IDENTICAL for every store:
 * - next.config.ts (SSR, no export, no basePath)
 * - api-client.ts (gateway client)
 * - API proxy route (catch-all forwarding)
 * - cart.ts (local checkout, no redirect)
 * - .env.local (API_GATEWAY_URL, STORE_SLUG)
 * - Analytics, CookieConsent, ThemeProvider, ThemeToggle
 *
 * The agent then writes ALL unique pages (home, products, checkout, account, etc.)
 * customized with the user's brand identity.
 */
export function initStoreDirV3(storeId: string, slug: string): string {
  const storeDir = getStoreDir(storeId);

  // Create directory structure (expanded for SSR: checkout, account, API routes)
  const dirs = [
    storeDir,
    join(storeDir, "src", "app"),
    join(storeDir, "src", "app", "products"),
    join(storeDir, "src", "app", "products", "[slug]"),
    join(storeDir, "src", "app", "category", "[slug]"),
    join(storeDir, "src", "app", "checkout"),
    join(storeDir, "src", "app", "account"),
    join(storeDir, "src", "app", "account", "login"),
    join(storeDir, "src", "app", "account", "register"),
    join(storeDir, "src", "app", "account", "orders"),
    join(storeDir, "src", "app", "account", "orders", "[orderId]"),
    join(storeDir, "src", "app", "account", "addresses"),
    join(storeDir, "src", "app", "account", "settings"),
    join(storeDir, "src", "app", "order-confirmation"),
    join(storeDir, "src", "app", "track", "[orderId]"),
    join(storeDir, "src", "app", "about"),
    join(storeDir, "src", "app", "faq"),
    join(storeDir, "src", "app", "search"),
    join(storeDir, "src", "app", "shipping-policy"),
    join(storeDir, "src", "app", "return-policy"),
    join(storeDir, "src", "app", "privacy-policy"),
    join(storeDir, "src", "app", "terms"),
    join(storeDir, "src", "app", "api", "[...path]"),
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

  // ─── Identical template files (builder writes, NOT agent) ─────────────

  // Package.json + config
  writeFileSync(join(storeDir, "package.json"), TEMPLATE_STORE_PACKAGE_JSON);
  writeFileSync(join(storeDir, "tsconfig.json"), TEMPLATE_STORE_TSCONFIG);
  writeFileSync(join(storeDir, "next.config.ts"), TEMPLATE_SSR_NEXT_CONFIG);
  writeFileSync(join(storeDir, "postcss.config.mjs"), TEMPLATE_STORE_POSTCSS_CONFIG);

  // Environment config
  const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  writeFileSync(join(storeDir, ".env.local"), getEnvLocal(slug, apiBaseUrl));

  // API gateway client
  writeFileSync(join(storeDir, "src", "lib", "api-client.ts"), TEMPLATE_API_CLIENT);

  // API proxy route (catch-all → FlowSmartly gateway)
  writeFileSync(join(storeDir, "src", "app", "api", "[...path]", "route.ts"), TEMPLATE_API_PROXY);

  // Cart with local checkout (no external redirect)
  writeFileSync(join(storeDir, "src", "lib", "cart.ts"), TEMPLATE_SSR_CART);

  // Theme provider + toggle
  writeFileSync(join(storeDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(storeDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);

  // Analytics (uses local /api/ proxy) + Cookie consent
  writeFileSync(join(storeDir, "src", "components", "Analytics.tsx"), getSSRTrackingScript(storeId));
  writeFileSync(join(storeDir, "src", "components", "CookieConsent.tsx"), TEMPLATE_STORE_COOKIE_CONSENT);

  return storeDir;
}

/**
 * Build a V3 SSR store (next build without static export).
 * Only runs the validators that apply to SSR builds.
 */
export async function buildStoreV3(storeId: string): Promise<{ success: boolean; output: string; error?: string }> {
  const storeDir = getStoreDir(storeId);

  if (!existsSync(storeDir)) {
    return { success: false, output: "", error: "Store directory not found" };
  }

  try {
    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "building" },
    });

    // 1. npm install — only if node_modules doesn't exist
    let installOutput = "";
    const nodeModulesExists = existsSync(join(storeDir, "node_modules", "next"));
    if (!nodeModulesExists) {
      console.log(`[StoreBuilder:V3] Installing dependencies for ${storeId}...`);
      installOutput = execSync("npm install --include=dev", {
        cwd: storeDir,
        timeout: 120000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
      });
    }

    // 2. Pre-build validators (SSR-applicable only)
    // Skip: syncBasePath, fixBareLinks, fixProductImages, fixGenerateStaticParams
    cleanupV3Patterns(storeDir); // Remove storeUrl/siteUrl/STORE_BASE left by agent
    fixTailwindV4Classes(storeDir); // Fix bg-primary-500 → bg-primary etc.
    fixGlobalsCss(storeDir); // Fix @apply inside @keyframes etc.
    const stubs = validateAndFixImports(storeDir);
    if (stubs.length > 0) {
      console.log(`[StoreBuilder:V3] Auto-fixed ${stubs.length} missing imports: ${stubs.join(", ")}`);
    }
    fixDataSyntax(storeDir, "src/lib/data.ts");
    fixDataSyntax(storeDir, "src/lib/products.ts");
    fixHamburgerMenu(storeDir);
    injectAnalytics(storeDir);

    // Clear build cache
    const nextCacheDir = join(storeDir, ".next");
    try { const { rmSync } = await import("fs"); rmSync(nextCacheDir, { recursive: true, force: true }); } catch {}

    // 3. next build (SSR — produces .next/, NOT out/)
    console.log(`[StoreBuilder:V3] Building SSR store ${storeId}...`);
    const buildOutput = execSync("npx next build", {
      cwd: storeDir,
      timeout: 180000,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null },
    });

    return { success: true, output: installOutput + "\n" + buildOutput };
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    console.error(`[StoreBuilder:V3] Build failed for ${storeId}:`, errorMsg.substring(0, 500));

    await prisma.store.update({
      where: { id: storeId },
      data: { buildStatus: "error", lastBuildError: errorMsg.substring(0, 2000) },
    });

    return { success: false, output: "", error: errorMsg };
  }
}

/**
 * Deploy a V3 SSR store — start as PM2 process + configure nginx reverse proxy.
 */
export async function deployStoreV3(storeId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  const storeDir = getStoreDir(storeId);
  const nextDir = join(storeDir, ".next");

  if (!existsSync(nextDir)) {
    return { success: false, error: "Build output not found (.next/). Run buildStoreV3 first." };
  }

  try {
    // Check resource limits
    const activeCount = await getActiveAppCount();
    if (activeCount >= MAX_CONCURRENT_APPS) {
      return { success: false, error: `Max concurrent apps reached (${MAX_CONCURRENT_APPS}). Stop some apps first.` };
    }

    // Allocate port
    const port = await allocatePort("store");
    const processName = `store-${slug}`;

    // Update DB with port/process info
    await prisma.store.update({
      where: { id: storeId },
      data: {
        ssrPort: port,
        ssrProcessName: processName,
        ssrStatus: "starting",
        storeVersion: "independent",
        generatorVersion: "v3",
        generatedPath: storeDir,
        isActive: true,
        setupComplete: true,
      },
    });

    // Start PM2 process
    console.log(`[StoreBuilder:V3] Starting ${processName} on port ${port}...`);
    await startApp({
      name: processName,
      cwd: storeDir,
      port,
      slug,
    });

    // Wait for the app to be healthy
    const healthy = await waitForHealthy(port, 30_000);
    if (!healthy) {
      console.warn(`[StoreBuilder:V3] ${processName} not healthy after 30s, but process may still be starting`);
    }

    // Update status to running
    await prisma.store.update({
      where: { id: storeId },
      data: { ssrStatus: healthy ? "running" : "starting" },
    });

    // Regenerate nginx config
    await regenerateAndReload();

    console.log(`[StoreBuilder:V3] Deployed store ${storeId} as ${processName} on port ${port}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[StoreBuilder:V3] Deploy failed:`, err.message);

    await prisma.store.update({
      where: { id: storeId },
      data: { ssrStatus: "error" },
    });

    return { success: false, error: err.message };
  }
}

/**
 * Stop a V3 SSR store process (release resources, keep files).
 */
export async function stopStoreV3(storeId: string): Promise<void> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ssrProcessName: true },
  });

  if (store?.ssrProcessName) {
    await stopApp(store.ssrProcessName);
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { ssrStatus: "stopped" },
  });

  await regenerateAndReload();
}

/**
 * Restart a V3 SSR store (rebuild + redeploy).
 */
export async function restartStoreV3(storeId: string, slug: string): Promise<{ success: boolean; error?: string }> {
  // Stop existing process
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ssrProcessName: true, ssrPort: true },
  });

  if (store?.ssrProcessName) {
    await deleteApp(store.ssrProcessName);
  }

  // Rebuild
  const buildResult = await buildStoreV3(storeId);
  if (!buildResult.success) {
    return { success: false, error: buildResult.error };
  }

  // Redeploy
  return deployStoreV3(storeId, slug);
}
