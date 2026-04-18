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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Reference store location — use env var to avoid hardcoded user paths
const REFERENCE_BASE = process.env.REFERENCE_STORE_PATH
  || (process.platform === "win32"
    ? join(process.cwd(), "reference-store", "src")
    : "/opt/reference-store/src");
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
  TEMPLATE_STRIPE_CONFIRM_PAGE,
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

const STORES_BASE = process.env.GENERATED_STORES_PATH
  || (process.platform === "win32"
    ? join(process.cwd(), "generated-stores")
    : "/var/www/flowsmartly/generated-stores");

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

// ─── Build Lock ──────────────────────────────────────────────────────────────

/**
 * Atomically acquire a build lock for a store.
 * Uses a Prisma conditional update: only sets "building" if current status is NOT "building".
 * Returns true if lock was acquired, false if another build is already running.
 */
export async function acquireBuildLock(storeId: string): Promise<boolean> {
  try {
    // Atomic: only update if not already building (prevents race condition)
    const result = await prisma.$executeRawUnsafe(
      `UPDATE "Store" SET "buildStatus" = 'building', "buildStartedAt" = NOW() WHERE "id" = $1 AND ("buildStatus" IS NULL OR "buildStatus" != 'building')`,
      storeId
    );
    return result > 0; // 1 = lock acquired, 0 = already building
  } catch {
    return false;
  }
}

/**
 * Release the build lock by setting a final status.
 */
async function releaseBuildLock(
  storeId: string,
  status: "built" | "error",
  error?: string
): Promise<void> {
  await prisma.store.update({
    where: { id: storeId },
    data: status === "built"
      ? { buildStatus: "built", lastBuildAt: new Date(), lastBuildError: null, buildStartedAt: null }
      : { buildStatus: "error", lastBuildError: error?.substring(0, 5000), buildStartedAt: null },
  });
}

// Track active builds for cancellation
const activeBuildProcesses = new Map<string, { cancel: () => void }>();

export function cancelBuild(storeId: string): boolean {
  const proc = activeBuildProcesses.get(storeId);
  if (proc) {
    proc.cancel();
    activeBuildProcesses.delete(storeId);
    return true;
  }
  return false;
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
    join(storeDir, "src", "app", "checkout", "confirm"),
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

  // Stripe payment confirm page — pre-built, agent must NOT overwrite
  writeFileSync(
    join(storeDir, "src", "app", "checkout", "confirm", "page.tsx"),
    TEMPLATE_STRIPE_CONFIRM_PAGE
  );

  // Checkout page — pre-built from reference-store with Stripe PaymentElement,
  // saved cards, 3-step stepper, dynamic payment methods. Agent must NOT overwrite.
  const refCheckoutPath = join(REFERENCE_BASE, "app", "checkout", "page.tsx");
  if (existsSync(refCheckoutPath)) {
    writeFileSync(join(storeDir, "src", "app", "checkout", "page.tsx"), readFileSync(refCheckoutPath));
  }

  // AccountModalProvider — MUST render {children}. Agent has historically
  // generated stubs that swallow the page, so we pre-build it.
  const refAMPPath = join(REFERENCE_BASE, "components", "AccountModalProvider.tsx");
  if (existsSync(refAMPPath)) {
    writeFileSync(join(storeDir, "src", "components", "AccountModalProvider.tsx"), readFileSync(refAMPPath));
  }

  // Account dashboard — redirects to AccountModal (side drawer handles everything).
  const refAccountPath = join(REFERENCE_BASE, "app", "account", "page.tsx");
  if (existsSync(refAccountPath)) {
    writeFileSync(join(storeDir, "src", "app", "account", "page.tsx"), readFileSync(refAccountPath));
  }

  // Login/register pages — redirect to AccountModal (side drawer).
  // Auth is handled by the AccountModal, NOT standalone pages.
  const refLoginPath = join(REFERENCE_BASE, "app", "account", "login", "page.tsx");
  const refRegisterPath = join(REFERENCE_BASE, "app", "account", "register", "page.tsx");
  if (existsSync(refLoginPath)) {
    writeFileSync(join(storeDir, "src", "app", "account", "login", "page.tsx"), readFileSync(refLoginPath));
  }
  if (existsSync(refRegisterPath)) {
    writeFileSync(join(storeDir, "src", "app", "account", "register", "page.tsx"), readFileSync(refRegisterPath));
  }

  // Account orders pages — pre-built from reference-store, agent must NOT overwrite
  // These implement: real order list with pending CTA, order detail with
  // cancel (pre-fulfillment), address change (pre-fulfillment), return request (DELIVERED only)
  const refOrdersListPath = join(REFERENCE_BASE, "app", "account", "orders", "page.tsx");
  const refOrderDetailPath = join(REFERENCE_BASE, "app", "account", "orders", "[orderId]", "page.tsx");
  if (existsSync(refOrdersListPath)) {
    writeFileSync(join(storeDir, "src", "app", "account", "orders", "page.tsx"), readFileSync(refOrdersListPath));
  }
  if (existsSync(refOrderDetailPath)) {
    writeFileSync(join(storeDir, "src", "app", "account", "orders", "[orderId]", "page.tsx"), readFileSync(refOrderDetailPath));
  }

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

  // Base globals.css — @custom-variant dark is CRITICAL for class-based dark mode.
  // The agent will update @theme {} colors, but this ensures the variant is always present.
  writeFileSync(
    join(storeDir, "src", "app", "globals.css"),
    `@import "tailwindcss";\n\n/* Class-based dark mode — REQUIRED for ThemeProvider toggle to work */\n@custom-variant dark (&:where(.dark, .dark *));\n\n@theme {\n  --color-primary: #6366f1;\n  --color-secondary: #8b5cf6;\n  --color-accent: #f59e0b;\n}\n`
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
    // Do NOT run fixDataSyntax on products.ts — product-sync handles escaping properly
    // and the validator breaks strings containing apostrophes + escaped quotes
    fixHamburgerMenu(storeDir);
    injectAnalytics(storeDir);

    // 3. next build (SSR) — Next.js overwrites .next atomically, no need to delete.
    // Deleting .next first would make PM2's running process serve 404s during the build.
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

  // Atomic build lock — prevents concurrent builds for the same store
  const locked = await acquireBuildLock(storeId);
  if (!locked) {
    console.warn(`[StoreBuilder:V3] Build already in progress for ${storeId}, marking pendingRebuild`);
    await prisma.store.update({ where: { id: storeId }, data: { pendingRebuild: true } });
    return { success: false, output: "", error: "Build already in progress — queued for rebuild" };
  }

  // Rollback support: copy current .next to .next.bak (keep original in place so the
  // running PM2 process keeps serving the previous build during the rebuild).
  const nextDir = join(storeDir, ".next");
  const nextBackup = join(storeDir, ".next.bak");
  try {
    const { rmSync, cpSync } = await import("fs");
    if (existsSync(nextBackup)) rmSync(nextBackup, { recursive: true, force: true });
    if (existsSync(nextDir)) cpSync(nextDir, nextBackup, { recursive: true });
  } catch {}

  try {
    const result = await buildStoreFromDir(storeDir);

    if (result.success) {
      // Build succeeded — remove backup
      try { const { rmSync } = await import("fs"); rmSync(nextBackup, { recursive: true, force: true }); } catch {}
      await releaseBuildLock(storeId, "built");
    } else {
      // Build failed — rollback to previous .next (may be partially overwritten)
      try {
        const { renameSync, rmSync } = await import("fs");
        if (existsSync(nextDir)) rmSync(nextDir, { recursive: true, force: true });
        if (existsSync(nextBackup)) renameSync(nextBackup, nextDir);
        console.log(`[StoreBuilder:V3] Rolled back to previous build for ${storeId}`);
      } catch {}
      await releaseBuildLock(storeId, "error", result.error);
    }

    // Check if a rebuild was queued while we were building
    const store = await prisma.store.findUnique({ where: { id: storeId }, select: { pendingRebuild: true, slug: true } });
    if (store?.pendingRebuild) {
      await prisma.store.update({ where: { id: storeId }, data: { pendingRebuild: false } });
      console.log(`[StoreBuilder:V3] Processing queued rebuild for ${storeId}`);
      // Don't await — let it run as a separate build cycle
      buildStoreV3(storeId).catch(e => console.error(`[StoreBuilder:V3] Queued rebuild failed:`, e));
    }

    return result;
  } catch (err: any) {
    const errorMsg = err.stderr?.toString() || err.stdout?.toString() || err.message || "Build failed";
    console.error(`[StoreBuilder:V3] Build failed for ${storeId}:`, errorMsg.substring(0, 500));

    // Rollback on exception
    try {
      const { renameSync, rmSync } = await import("fs");
      if (existsSync(nextDir)) rmSync(nextDir, { recursive: true, force: true });
      if (existsSync(nextBackup)) renameSync(nextBackup, nextDir);
    } catch {}

    await releaseBuildLock(storeId, "error", errorMsg);
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

    // Reuse existing port if already assigned, otherwise allocate a new one
    const existing = await prisma.store.findUnique({
      where: { id: storeId },
      select: { ssrPort: true, ssrProcessName: true },
    });
    const port = existing?.ssrPort || await allocatePort("store");
    const processName = existing?.ssrProcessName || `store-${slug}`;

    // Stop existing PM2 process if running (clean restart)
    try {
      const { execSync } = await import("child_process");
      execSync(`pm2 delete ${processName} 2>/dev/null || true`, { stdio: "ignore" });
    } catch {}

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

    // Start PM2 process on the assigned port
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
