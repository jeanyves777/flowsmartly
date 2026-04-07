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
  writeFileSync(join(siteDir, "tailwind.config.ts"), TEMPLATE_TAILWIND_CONFIG);
  writeFileSync(join(siteDir, "src", "components", "ThemeProvider.tsx"), TEMPLATE_THEME_PROVIDER);
  writeFileSync(join(siteDir, "src", "components", "ThemeToggle.tsx"), TEMPLATE_THEME_TOGGLE);

  // 404 and error pages (brand-neutral defaults — agent can overwrite with branded versions)
  writeFileSync(join(siteDir, "src", "app", "not-found.tsx"), `"use client";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-neutral-900 dark:text-white mb-4">404</h1>
      <p className="text-xl text-neutral-600 dark:text-neutral-400 mb-8">Page not found</p>
      <a href="/" className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium hover:opacity-90 transition-opacity">
        Go Home
      </a>
    </div>
  );
}
`);

  // Tracking script + cookie consent
  const apiBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmartly.com";
  writeFileSync(join(siteDir, "src", "components", "Analytics.tsx"), getTrackingScript(websiteId, apiBaseUrl));
  writeFileSync(join(siteDir, "src", "components", "CookieConsent.tsx"), TEMPLATE_COOKIE_CONSENT);

  // Privacy, cookie, terms policy pages
  mkdirSync(join(siteDir, "src", "app", "privacy-policy"), { recursive: true });
  mkdirSync(join(siteDir, "src", "app", "cookie-policy"), { recursive: true });
  mkdirSync(join(siteDir, "src", "app", "terms"), { recursive: true });

  const policyPage = (title: string, content: string) => `"use client";

export default function ${title.replace(/[^a-zA-Z]/g, "")}Page() {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">${title}</h1>
        <div className="prose dark:prose-invert max-w-none text-neutral-600 dark:text-neutral-400 space-y-4">
          ${content}
        </div>
      </div>
    </div>
  );
}
`;

  writeFileSync(join(siteDir, "src", "app", "privacy-policy", "page.tsx"), policyPage("Privacy Policy",
    `<p>This privacy policy explains how we collect, use, and protect your personal information.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Information We Collect</h2>
          <p>We may collect personal information such as your name, email address, and browsing behavior when you visit our website.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">How We Use Your Information</h2>
          <p>We use your information to improve our services, respond to inquiries, and send relevant communications.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Data Protection</h2>
          <p>We implement appropriate security measures to protect your personal data against unauthorized access or disclosure.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Contact Us</h2>
          <p>If you have questions about this policy, please contact us through our website.</p>`
  ));

  writeFileSync(join(siteDir, "src", "app", "cookie-policy", "page.tsx"), policyPage("Cookie Policy",
    `<p>This website uses cookies to enhance your browsing experience.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">What Are Cookies</h2>
          <p>Cookies are small text files stored on your device that help us understand how you use our website.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Types of Cookies We Use</h2>
          <p><strong>Essential cookies:</strong> Required for the website to function properly.</p>
          <p><strong>Analytics cookies:</strong> Help us understand visitor behavior and improve our site.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Managing Cookies</h2>
          <p>You can control cookies through your browser settings. Declining cookies may affect your experience.</p>`
  ));

  writeFileSync(join(siteDir, "src", "app", "terms", "page.tsx"), policyPage("Terms of Service",
    `<p>By using this website, you agree to the following terms and conditions.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Use of Website</h2>
          <p>This website is provided for informational purposes. You agree to use it in accordance with applicable laws.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Intellectual Property</h2>
          <p>All content on this website is protected by copyright and may not be reproduced without permission.</p>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mt-6">Limitation of Liability</h2>
          <p>We are not liable for any damages arising from the use of this website.</p>`
  ));

  writeFileSync(join(siteDir, "src", "app", "error.tsx"), `"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">Something went wrong</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">{error.message || "An unexpected error occurred"}</p>
      <button onClick={reset} className="px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg font-medium hover:opacity-90 transition-opacity">
        Try Again
      </button>
    </div>
  );
}
`);

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
