/**
 * Store Site Builder — handles npm install, next build, and deployment
 * for agent-generated store sites.
 *
 * V2: Static export → nginx static files
 * V3: Independent SSR app → PM2 process + nginx reverse proxy
 *
 * Mirrors src/lib/website/site-builder.ts but for e-commerce stores.
 */

import { spawn as spawnProcess } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db/client";
import {
  TEMPLATE_STORE_PACKAGE_JSON,
  TEMPLATE_STORE_TSCONFIG,
  TEMPLATE_STORE_POSTCSS_CONFIG,
  TEMPLATE_STORE_COOKIE_CONSENT,
  TEMPLATE_THEME_PROVIDER,
  TEMPLATE_THEME_TOGGLE,
} from "./templates";
import {
  generateSSRNextConfig,
  TEMPLATE_SSR_NOT_FOUND,
  TEMPLATE_API_CLIENT,
  TEMPLATE_API_PROXY,
  TEMPLATE_SSR_CART,
  getEnvLocal,
  getSSRTrackingScript,
} from "./templates/ssr-templates";
import {
  validateAndFixImports,
  fixDataSyntax,
  fixHamburgerMenu,
  injectAnalytics,
  cleanupV3Patterns,
  fixTailwindV4Classes,
  fixGlobalsCss,
  fixUseSearchParams,
  fixCartImports,
  fixHeaderLayout,
  fixFooterLogoSize,
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

export function getStoreDir(storeId: string): string {
  return join(STORES_BASE, storeId);
}

/** Write a file into the store directory (used by the AI agent). */
export function writeStoreFile(storeId: string, relativePath: string, content: string): void {
  const filePath = join(getStoreDir(storeId), relativePath);
  const dir = join(filePath, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}

/**
 * Non-blocking command execution — doesn't freeze the event loop.
 * Use this for long-running commands (npm install, next build).
 */
function execAsync(cmd: string, options: { cwd: string; env?: NodeJS.ProcessEnv; timeout?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const [bin, ...args] = cmd.split(" ");
    const child = spawnProcess(bin, args, {
      cwd: options.cwd,
      env: options.env || process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });

    const timer = options.timeout ? setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${options.timeout}ms`));
    }, options.timeout) : null;

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(Object.assign(new Error(`Command failed with code ${code}`), { stdout, stderr }));
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
  });
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
  writeFileSync(join(storeDir, "next.config.ts"), generateSSRNextConfig(`/stores/${slug}`));
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

  // App Router 404 — prevents cascading prerender error for /404
  writeFileSync(join(storeDir, "src", "app", "not-found.tsx"), TEMPLATE_SSR_NOT_FOUND);

  // Pages Router shims — Next.js 15 still exports /_error:/404 even in App Router projects.
  // Without _document.tsx, that export fails with "<Html> outside _document" error.
  mkdirSync(join(storeDir, "src", "pages"), { recursive: true });
  writeFileSync(
    join(storeDir, "src", "pages", "_document.tsx"),
    `import { Html, Head, Main, NextScript } from "next/document";\nexport default function Document() {\n  return (<Html><Head /><body><Main /><NextScript /></body></Html>);\n}\n`
  );
  writeFileSync(
    join(storeDir, "src", "pages", "404.tsx"),
    `export default function Custom404() { return null; }\n`
  );

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
 *
 * This is the DB-free core that `buildStoreV3` delegates to.
 * Call it directly from scripts/tests to avoid needing a Prisma store record.
 */
export async function buildStoreFromDir(
  storeDir: string,
): Promise<{ success: boolean; output: string; error?: string }> {
  if (!existsSync(storeDir)) {
    return { success: false, output: "", error: `Store directory not found: ${storeDir}` };
  }

  try {
    // 1. npm install — only if node_modules doesn't exist
    let installOutput = "";
    const nodeModulesExists = existsSync(join(storeDir, "node_modules", "next"));
    if (!nodeModulesExists) {
      console.log(`[StoreBuilder] Installing dependencies in ${storeDir}...`);
      installOutput = await execAsync("npm install --include=dev", {
        cwd: storeDir,
        timeout: 120000,
        env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048", NODE_ENV: "development" },
      });
    }

    // 2. Pre-build validators (SSR-applicable only)
    cleanupV3Patterns(storeDir);
    fixTailwindV4Classes(storeDir);
    fixGlobalsCss(storeDir);
    fixUseSearchParams(storeDir);
    const stubs = validateAndFixImports(storeDir);
    if (stubs.length > 0) {
      console.log(`[StoreBuilder] Auto-fixed ${stubs.length} missing imports: ${stubs.join(", ")}`);
    }
    fixCartImports(storeDir);
    fixHeaderLayout(storeDir); // Fix tiny logo + misaligned icon row in Header
    fixFooterLogoSize(storeDir); // Fix tiny logo in Footer
    fixDataSyntax(storeDir, "src/lib/data.ts");
    fixDataSyntax(storeDir, "src/lib/products.ts");
    fixHamburgerMenu(storeDir);
    injectAnalytics(storeDir);

    // Clear build cache
    const nextCacheDir = join(storeDir, ".next");
    try { const { rmSync } = await import("fs"); rmSync(nextCacheDir, { recursive: true, force: true }); } catch {}

    // 3. next build (SSR)
    console.log(`[StoreBuilder] Building store at ${storeDir}...`);
    const buildOutput = await execAsync("npx next build", {
      cwd: storeDir,
      timeout: 300000,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=2048" },
    });

    return { success: true, output: installOutput + "\n" + buildOutput };
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    return { success: false, output: "", error: errorMsg };
  }
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

    const result = await buildStoreFromDir(storeDir);

    await prisma.store.update({
      where: { id: storeId },
      data: result.success
        ? { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null }
        : { buildStatus: "error", lastBuildError: result.error?.substring(0, 2000) },
    });

    return result;
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
