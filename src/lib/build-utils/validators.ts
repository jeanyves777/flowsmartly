/**
 * Shared pre-build validators for Website Builder and Store Builder.
 * These run automatically before `next build` to fix common agent mistakes.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";

// ─── Utility helpers ─────────────────────────────────────────────────────────

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recursively collect all .ts/.tsx/.jsx/.js files in a directory,
 * skipping node_modules and .next.
 */
export function collectSourceFiles(dir: string, files: string[] = []): string[] {
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

// ─── syncBasePath ────────────────────────────────────────────────────────────

/**
 * Sync basePath across next.config.ts, the main data file (SITE_BASE / STORE_BASE),
 * and all bare /images/ src/href paths in source files.
 *
 * @param siteDir   Root of the generated project
 * @param basePath  e.g. "/sites/my-slug" or "/stores/my-slug"
 * @param slug      The site/store slug
 * @param baseConst Name of the exported constant, e.g. "SITE_BASE" or "STORE_BASE"
 * @param dataRelPath Relative path to the data file, e.g. "src/lib/data.ts"
 */
export function syncBasePath(
  siteDir: string,
  basePath: string,
  slug: string,
  baseConst: string = "SITE_BASE",
  dataRelPath: string = "src/lib/data.ts"
): void {
  // Update next.config.ts
  const configPath = join(siteDir, "next.config.ts");
  if (existsSync(configPath)) {
    let config = readFileSync(configPath, "utf-8");
    config = config.replace(/basePath:\s*['"][^'"]*['"]/, `basePath: '${basePath}'`);
    writeFileSync(configPath, config);
  }

  // Update base constant in data file
  const dataPath = join(siteDir, dataRelPath);
  if (existsSync(dataPath)) {
    let data = readFileSync(dataPath, "utf-8");
    data = data.replace(
      new RegExp(`export const ${baseConst}\\s*=\\s*['"][^'"]*['"]`),
      `export const ${baseConst} = '${basePath}'`
    );

    // Rewrite image paths: ensure /images/ paths carry the basePath prefix
    // Derive the route prefix from basePath (e.g. "/sites/slug" or "/stores/slug")
    const oldPrefix = basePath; // will already contain the correct prefix
    if (basePath === "") {
      // Custom domain: strip prefix from image paths
      // Determine slug-based prefix to strip (could be /sites/slug or /stores/slug)
      const sitePrefix = `/sites/${slug}`;
      const storePrefix = `/stores/${slug}`;
      data = data.replace(new RegExp(escapeRegex(sitePrefix) + "(/images/)", "g"), "$1");
      data = data.replace(new RegExp(escapeRegex(storePrefix) + "(/images/)", "g"), "$1");
    } else if (!data.includes(`${basePath}/images/`)) {
      // No custom domain: ensure bare /images/ paths have the basePath prefix
      data = data.replace(/(?<=["'])\/images\//g, `${basePath}/images/`);
    }
    // Fix navLinks and footerLinks: prefix bare href paths with basePath
    // e.g. { href: '/about' } → { href: '/sites/slug/about' }
    if (basePath) {
      const escaped = escapeRegex(basePath);
      // Match href: '/path' or href: "/path" where path doesn't already have basePath
      data = data.replace(
        new RegExp(`(href:\\s*['"])(?!${escaped}|https?://|mailto:|tel:|#)(/[^'"]*['"])`, "g"),
        `$1${basePath}$2`
      );
    }

    writeFileSync(dataPath, data);
  }

  // Prefix bare /images/ paths in source files with basePath
  const srcDir = join(siteDir, "src");
  if (basePath && slug) {
    const files = collectSourceFiles(srcDir);
    let imgFixCount = 0;
    for (const file of files) {
      let content = readFileSync(file, "utf-8");
      const original = content;
      // Fix src="/images/..." → src="{basePath}/images/..." (skip if already prefixed)
      content = content.replace(
        new RegExp(`src="(?!${escapeRegex(basePath)})/images/`, "g"),
        `src="${basePath}/images/`
      );
      // Also fix href="/images/..." in case images are used as links
      content = content.replace(
        new RegExp(`href="(?!${escapeRegex(basePath)})/images/`, "g"),
        `href="${basePath}/images/`
      );
      if (content !== original) {
        writeFileSync(file, content);
        imgFixCount++;
      }
    }
    if (imgFixCount > 0) {
      console.log(`[BuildUtils] Prefixed bare /images/ paths in ${imgFixCount} source files`);
    }
  }

  console.log(`[BuildUtils] Synced basePath to '${basePath}' for slug '${slug}'`);
}

// ─── validateAndFixImports ───────────────────────────────────────────────────

/**
 * Scan all source files for @/ imports that don't resolve.
 * Auto-creates minimal stub files for missing modules so the build doesn't crash.
 */
export function validateAndFixImports(siteDir: string): string[] {
  const srcDir = join(siteDir, "src");
  const files = collectSourceFiles(srcDir);
  const createdStubs: string[] = [];
  const missingImports = new Set<string>();

  for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const importRegex = /from\s+['"]@\/([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      const resolvedBase = join(srcDir, importPath);
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

  for (const importPath of Array.from(missingImports)) {
    const isComponent = importPath.startsWith("components/");
    const componentName = importPath.split("/").pop() || "Unknown";
    const ext = isComponent ? ".tsx" : ".ts";
    const stubPath = join(srcDir, importPath + ext);

    mkdirSync(dirname(stubPath), { recursive: true });

    if (isComponent) {
      const stub = `"use client";\n\nexport default function ${componentName}(props: Record<string, unknown>) {\n  return <div data-component="${componentName}" />;\n}\n`;
      writeFileSync(stubPath, stub, "utf-8");
    } else {
      writeFileSync(stubPath, `// Auto-generated stub for missing module: ${importPath}\nexport default {};\n`, "utf-8");
    }

    createdStubs.push(importPath);
    console.log(`[BuildUtils] Created stub for missing import: @/${importPath}`);
  }

  return createdStubs;
}

// ─── fixDataSyntax ───────────────────────────────────────────────────────────

/**
 * Fix unescaped single quotes inside single-quoted strings in data files.
 * Converts broken 'text with ' inside' → "text with ' inside".
 */
export function fixDataSyntax(siteDir: string, dataRelPath: string = "src/lib/data.ts"): void {
  const dataPath = join(siteDir, dataRelPath);
  if (!existsSync(dataPath)) return;

  let content = readFileSync(dataPath, "utf-8");
  const original = content;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const unescaped = line.replace(/\\'/g, "").match(/'/g);
    if (unescaped && unescaped.length % 2 !== 0) {
      const firstQ = line.indexOf("'");
      const lastQ = line.lastIndexOf("'");
      if (firstQ !== lastQ && firstQ >= 0) {
        const before = line.substring(0, firstQ);
        const middle = line.substring(firstQ + 1, lastQ).replace(/\\'/g, "'");
        const after = line.substring(lastQ + 1);
        const escaped = middle.replace(/"/g, '\\"');
        lines[i] = `${before}"${escaped}"${after}`;
      }
    }
  }
  content = lines.join("\n");

  if (content !== original) {
    writeFileSync(dataPath, content, "utf-8");
    console.log(`[BuildUtils] Auto-fixed data syntax (unescaped quotes) in ${dataRelPath}`);
  }
}

// ─── fixBareLinks ────────────────────────────────────────────────────────────

/**
 * Fix bare internal links (href="/about") that are missing the basePath prefix.
 * Idempotent — skips links that already have the correct prefix.
 */
export function fixBareLinks(siteDir: string, basePath: string): void {
  if (!basePath) return;

  const srcDir = join(siteDir, "src");
  const files = collectSourceFiles(srcDir);
  let fixCount = 0;
  const escaped = escapeRegex(basePath);

  for (const file of files) {
    let content = readFileSync(file, "utf-8");
    const original = content;

    // Fix href="/" -> href="{basePath}/" (but not if already prefixed)
    content = content.replace(
      new RegExp(`href="(?!${escaped})/"`, "g"),
      `href="${basePath}/"`
    );

    // Fix href="/word..." but NOT if already prefixed, and NOT /sites/, /stores/, /_next/, /images/
    content = content.replace(
      new RegExp(`href="(?!${escaped})/(?!sites/|stores/|_next/|images/)([a-zA-Z][a-zA-Z0-9/-]*)`, "g"),
      `href="${basePath}/$1`
    );

    // Fix href="/#hash" -> href="{basePath}/#hash"
    content = content.replace(
      new RegExp(`href="(?!${escaped})/#`, "g"),
      `href="${basePath}/#`
    );

    // Fix href="#" (bare hash) -> href="{basePath}/"
    content = content.replace(/href="#"/g, `href="${basePath}/"`);

    // Fix template literal links: href={`/path`} and href={`/#hash`}
    content = content.replace(
      new RegExp("href=\\{`(?!" + escaped + ")/(?!sites/|stores/|_next/|images/)([a-zA-Z#][^`]*)`\\}", "g"),
      `href={\`${basePath}/$1\`}`
    );

    if (content !== original) {
      writeFileSync(file, content);
      fixCount++;
    }
  }

  if (fixCount > 0) {
    console.log(`[BuildUtils] Auto-fixed bare links in ${fixCount} files (basePath: ${basePath})`);
  }
}

// ─── fixHamburgerMenu ────────────────────────────────────────────────────────

/**
 * Replace AnimatePresence-wrapped hamburger icon with simple conditional render.
 * AnimatePresence with opacity:0 initial state makes the icon invisible on static export.
 */
export function fixHamburgerMenu(siteDir: string): void {
  const headerPath = join(siteDir, "src", "components", "Header.tsx");
  if (!existsSync(headerPath)) return;

  let content = readFileSync(headerPath, "utf-8");

  if (!content.includes("AnimatePresence") || !content.includes("Toggle menu")) return;

  const animatedPattern = /<AnimatePresence[^>]*>\s*\{isMobileMenuOpen\s*\?\s*\(\s*<motion\.div[\s\S]*?<X[\s\S]*?<\/motion\.div>\s*\)\s*:\s*\(\s*<motion\.div[\s\S]*?<Menu[\s\S]*?<\/motion\.div>\s*\)\s*\}\s*<\/AnimatePresence>/;

  if (animatedPattern.test(content)) {
    content = content.replace(animatedPattern, "{isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}");
    writeFileSync(headerPath, content);
    console.log("[BuildUtils] Fixed hamburger menu: replaced AnimatePresence with simple conditional");
  }
}

// ─── injectAnalytics ─────────────────────────────────────────────────────────

/**
 * Inject Analytics + CookieConsent components into layout.tsx if missing.
 */
export function injectAnalytics(siteDir: string): void {
  const layoutPath = join(siteDir, "src", "app", "layout.tsx");
  if (!existsSync(layoutPath)) return;

  let content = readFileSync(layoutPath, "utf-8");
  let modified = false;

  if (!content.includes("Analytics") && existsSync(join(siteDir, "src", "components", "Analytics.tsx"))) {
    const lastImportIdx = content.lastIndexOf("\nimport ");
    if (lastImportIdx !== -1) {
      const endOfImportLine = content.indexOf("\n", lastImportIdx + 1);
      content = content.slice(0, endOfImportLine + 1) +
        "import Analytics from '@/components/Analytics'\n" +
        content.slice(endOfImportLine + 1);
    }
    content = content.replace("</body>", "<Analytics />\n</body>");
    modified = true;
  }

  if (!content.includes("CookieConsent") && existsSync(join(siteDir, "src", "components", "CookieConsent.tsx"))) {
    if (!content.includes("import CookieConsent")) {
      const lastImportIdx = content.lastIndexOf("\nimport ");
      if (lastImportIdx !== -1) {
        const endOfImportLine = content.indexOf("\n", lastImportIdx + 1);
        content = content.slice(0, endOfImportLine + 1) +
          "import CookieConsent from '@/components/CookieConsent'\n" +
          content.slice(endOfImportLine + 1);
      }
    }
    content = content.replace("</body>", "<CookieConsent />\n</body>");
    modified = true;
  }

  if (modified) {
    writeFileSync(layoutPath, content);
    console.log("[BuildUtils] Injected Analytics + CookieConsent into layout.tsx");
  }
}

// ─── fixProductImages (store-specific) ───────────────────────────────────────

/**
 * Ensure all product image paths have the correct basePath prefix.
 * Checks both data files (products.ts) and component source files.
 */
export function fixProductImages(siteDir: string, basePath: string): void {
  if (!basePath) return;

  const escaped = escapeRegex(basePath);

  // Fix products.ts
  const productsPath = join(siteDir, "src", "lib", "products.ts");
  if (existsSync(productsPath)) {
    let content = readFileSync(productsPath, "utf-8");
    const original = content;
    // Fix bare /images/products/ paths
    content = content.replace(
      new RegExp(`(?<=["'])(?!${escaped})/images/products/`, "g"),
      `${basePath}/images/products/`
    );
    if (content !== original) {
      writeFileSync(productsPath, content);
      console.log("[BuildUtils] Fixed product image paths in products.ts");
    }
  }

  // Fix source files that reference product images
  const srcDir = join(siteDir, "src");
  const files = collectSourceFiles(srcDir);
  let fixCount = 0;
  for (const file of files) {
    let content = readFileSync(file, "utf-8");
    const original = content;
    content = content.replace(
      new RegExp(`src="(?!${escaped})/images/products/`, "g"),
      `src="${basePath}/images/products/`
    );
    if (content !== original) {
      writeFileSync(file, content);
      fixCount++;
    }
  }
  if (fixCount > 0) {
    console.log(`[BuildUtils] Fixed product image paths in ${fixCount} source files`);
  }
}

// ─── fixGenerateStaticParams (auto-split "use client" + generateStaticParams) ─

/**
 * Next.js 15 forbids "use client" + generateStaticParams() in the same file.
 * But output:'export' requires generateStaticParams() for dynamic [slug] routes.
 *
 * Fix: Split into server page.tsx (generateStaticParams) + Client component.
 * Scans all page.tsx files for the bad pattern and auto-fixes.
 */
export function fixGenerateStaticParams(siteDir: string): void {
  const srcDir = join(siteDir, "src");
  const files = collectSourceFiles(srcDir);
  let fixCount = 0;

  for (const file of files) {
    // Only process page.tsx files in dynamic [slug] directories
    if (!file.endsWith("page.tsx") && !file.endsWith("page.ts")) continue;
    if (!file.includes("[")) continue; // Only dynamic routes

    const content = readFileSync(file, "utf-8");

    // Detect the bad pattern: "use client" + generateStaticParams in same file
    const hasUseClient = /^["']use client["'];?/m.test(content);
    const hasGenStatic = /export\s+function\s+generateStaticParams/m.test(content);

    if (!hasUseClient || !hasGenStatic) continue;

    // Extract generateStaticParams function
    const genStaticMatch = content.match(
      /export\s+function\s+generateStaticParams\s*\(\)\s*\{[\s\S]*?\n\}/m
    );
    if (!genStaticMatch) continue;

    // Extract the default export function name
    const defaultExportMatch = content.match(
      /export\s+default\s+function\s+(\w+)/
    );
    if (!defaultExportMatch) continue;

    const componentName = defaultExportMatch[1];
    const clientComponentName = componentName + "Client";

    // Determine the directory of this page.tsx
    const dir = file.substring(0, file.lastIndexOf(process.platform === "win32" ? "\\" : "/"));

    // 1. Create client component: remove generateStaticParams, rename export
    let clientContent = content;
    // Remove the generateStaticParams function
    clientContent = clientContent.replace(
      /\/\/[^\n]*generateStaticParams[^\n]*\n/g, "" // Remove comments about it
    );
    clientContent = clientContent.replace(
      /export\s+function\s+generateStaticParams\s*\(\)\s*\{[\s\S]*?\n\}\n*/m, ""
    );
    // Rename the default export
    clientContent = clientContent.replace(
      `export default function ${componentName}`,
      `export default function ${clientComponentName}`
    );
    const clientPath = join(dir, `${clientComponentName}.tsx`);
    writeFileSync(clientPath, clientContent, "utf-8");

    // 2. Detect what generateStaticParams needs (products or categories import)
    const genStaticBody = genStaticMatch[0];
    let dataImport = "";
    if (genStaticBody.includes("products")) {
      dataImport = 'import { products } from "@/lib/products";';
    } else if (genStaticBody.includes("categories")) {
      dataImport = 'import { categories } from "@/lib/data";';
    }

    // 3. Detect params type
    const paramsMatch = content.match(/params\s*\}\s*:\s*\{\s*params\s*:\s*\{([^}]+)\}/);
    const paramsType = paramsMatch ? `{ params: { ${paramsMatch[1]} } }` : "{ params: { slug: string } }";

    // 4. Write server wrapper page.tsx
    const serverContent = `// Server wrapper — generateStaticParams for static export
// Auto-generated by fixGenerateStaticParams validator
${dataImport}
import ${clientComponentName} from "./${clientComponentName}";

${genStaticMatch[0]}

export default function ${componentName}({ params }: ${paramsType}) {
  return <${clientComponentName} params={params} />;
}
`;
    writeFileSync(file, serverContent, "utf-8");
    fixCount++;
    console.log(`[BuildUtils] Auto-split ${file} → ${clientComponentName}.tsx (generateStaticParams fix)`);
  }

  if (fixCount > 0) {
    console.log(`[BuildUtils] Fixed ${fixCount} pages with "use client" + generateStaticParams conflict`);
  }
}

// ─── V3 SSR Cleanup ─────────────────────────────────────────────────────────

/**
 * Clean up V2 patterns that agents sometimes leave in V3 SSR stores.
 * V3 stores have NO basePath, NO storeUrl/siteUrl, NO STORE_BASE/SITE_BASE.
 *
 * Fixes:
 * 1. Remove storeUrl()/siteUrl() wrapper from href values → bare paths
 * 2. Remove STORE_BASE/SITE_BASE declarations
 * 3. Remove storeUrl/siteUrl imports from components
 * 4. Replace <a> tags with internal hrefs to use bare paths (agent should use <Link> but some don't)
 * 5. Remove generateStaticParams exports (SSR doesn't need them)
 */
export function cleanupV3Patterns(siteDir: string): void {
  const srcDir = join(siteDir, "src");
  if (!existsSync(srcDir)) return;

  const files = collectSourceFiles(srcDir);
  let fixCount = 0;

  for (const file of files) {
    let content = readFileSync(file, "utf-8");
    const original = content;

    // 1. Replace storeUrl("/path") or siteUrl("/path") → "/path"
    content = content.replace(/(?:storeUrl|siteUrl)\(\s*(['"`])(.*?)\1\s*\)/g, '$1$2$1');

    // 2. Remove STORE_BASE/SITE_BASE declarations
    content = content.replace(/export\s+const\s+(?:STORE_BASE|SITE_BASE)\s*=\s*['"`].*?['"`];?\s*\n?/g, "");

    // 3. Remove storeUrl/siteUrl function declarations
    content = content.replace(/export\s+function\s+(?:storeUrl|siteUrl)\s*\([^)]*\)\s*(?::\s*string\s*)?\{[^}]*\}\s*\n?/g, "");

    // 4. Remove storeUrl/siteUrl from import statements
    // e.g. import { storeInfo, storeUrl } from "@/lib/data" → import { storeInfo } from "@/lib/data"
    content = content.replace(/,\s*(?:storeUrl|siteUrl)\s*(?=[,}])/g, "");
    content = content.replace(/(?:storeUrl|siteUrl)\s*,\s*/g, "");
    // If it was the only import: import { storeUrl } from ... → remove entire line
    content = content.replace(/import\s*\{\s*(?:storeUrl|siteUrl)\s*\}\s*from\s*['"].*?['"];?\s*\n?/g, "");

    // 5. Remove empty import {} lines left after cleanup
    content = content.replace(/import\s*\{\s*\}\s*from\s*['"].*?['"];?\s*\n?/g, "");

    if (content !== original) {
      writeFileSync(file, content, "utf-8");
      fixCount++;
    }
  }

  if (fixCount > 0) {
    console.log(`[BuildUtils] V3 cleanup: fixed ${fixCount} files (removed storeUrl/siteUrl/STORE_BASE patterns)`);
  }
}

// ─── Tailwind v4 Class Fixer ────────────────────────────────────────────────

/**
 * Fix invalid Tailwind v4 utility classes that agents generate.
 *
 * Common mistakes:
 * - bg-primary-950, text-primary-600, etc. (primary is a single color, not a scale)
 * - hover:bg-primary-700 → hover:bg-primary/70
 * - Same for secondary, accent, etc.
 *
 * In Tailwind v4 with @theme { --color-primary: #xxx }, only `bg-primary` works,
 * not `bg-primary-500`. Numbered variants need opacity modifiers: bg-primary/50.
 */
export function fixTailwindV4Classes(siteDir: string): void {
  const srcDir = join(siteDir, "src");
  if (!existsSync(srcDir)) return;

  const files = collectSourceFiles(srcDir);
  let fixCount = 0;

  // Map numbered shade to opacity approximation
  // 50→95, 100→90, 200→80, 300→70, 400→60, 500→(base), 600→80, 700→70, 800→50, 900→30, 950→20
  const shadeToOpacity: Record<string, string> = {
    "50": "/95", "100": "/90", "200": "/80", "300": "/70", "400": "/60",
    "500": "", "600": "/80", "700": "/70", "800": "/50", "900": "/30", "950": "/20",
  };

  // Custom theme colors that are single values (not scales)
  const customColors = ["primary", "secondary", "accent", "muted", "destructive"];

  for (const file of files) {
    let content = readFileSync(file, "utf-8");
    const original = content;

    for (const color of customColors) {
      // Match patterns like bg-primary-500, text-secondary-700, border-accent-200, etc.
      // Replace with bg-primary/opacity
      const regex = new RegExp(
        `((?:bg|text|border|ring|outline|shadow|from|to|via|fill|stroke|placeholder|divide|decoration)-${color})-(\\d{2,3})`,
        "g"
      );
      content = content.replace(regex, (match, prefix, shade) => {
        const opacity = shadeToOpacity[shade];
        if (opacity === undefined) return match; // Unknown shade, leave as-is
        return `${prefix}${opacity}`;
      });
    }

    if (content !== original) {
      writeFileSync(file, content, "utf-8");
      fixCount++;
    }
  }

  // Also fix globals.css — agent might use invalid @apply classes
  const globalsCss = join(srcDir, "app", "globals.css");
  if (existsSync(globalsCss)) {
    let css = readFileSync(globalsCss, "utf-8");
    const originalCss = css;

    for (const color of customColors) {
      const regex = new RegExp(
        `((?:bg|text|border|ring)-${color})-(\\d{2,3})`,
        "g"
      );
      css = css.replace(regex, (match, prefix, shade) => {
        const opacity = shadeToOpacity[shade];
        if (opacity === undefined) return match;
        return `${prefix}${opacity}`;
      });
    }

    if (css !== originalCss) {
      writeFileSync(globalsCss, css, "utf-8");
      fixCount++;
    }
  }

  if (fixCount > 0) {
    console.log(`[BuildUtils] Tailwind v4 fix: fixed ${fixCount} files (replaced color-shade with color/opacity)`);
  }
}

// ─── useSearchParams Suspense Fix ───────────────────────────────────────────

/**
 * Next.js 15+ requires useSearchParams() to be inside a Suspense boundary.
 * If a page.tsx uses useSearchParams (directly or via "use client"), auto-wrap
 * it by renaming to ClientComponent.tsx and creating a server wrapper with Suspense.
 */
export function fixUseSearchParams(siteDir: string): void {
  const appDir = join(siteDir, "src", "app");
  if (!existsSync(appDir)) return;

  const pageFiles = collectSourceFiles(appDir).filter(f => f.endsWith("page.tsx"));
  let fixCount = 0;

  for (const file of pageFiles) {
    const content = readFileSync(file, "utf-8");
    if (!content.includes("useSearchParams")) continue;
    if (!content.includes('"use client"') && !content.includes("'use client'")) continue;

    // This is a "use client" page with useSearchParams — needs Suspense wrapper
    const dir = dirname(file);
    const pageName = dir.split(/[\\/]/).pop() || "Page";
    const clientName = pageName.charAt(0).toUpperCase() + pageName.slice(1).replace(/-(\w)/g, (_, c) => c.toUpperCase()) + "Client";

    // Rename page.tsx → {ClientName}.tsx
    const clientPath = join(dir, `${clientName}.tsx`);
    writeFileSync(clientPath, content, "utf-8");

    // Write new server wrapper page.tsx with Suspense
    const wrapper = `import { Suspense } from "react";
import ${clientName} from "./${clientName}";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-2 border-gray-900 border-t-transparent rounded-full" /></div>}>
      <${clientName} />
    </Suspense>
  );
}
`;
    writeFileSync(file, wrapper, "utf-8");
    fixCount++;
    console.log(`[BuildUtils] Wrapped ${file} in Suspense (useSearchParams fix)`);
  }

  if (fixCount > 0) {
    console.log(`[BuildUtils] Fixed ${fixCount} pages with useSearchParams Suspense boundary`);
  }
}

// ─── Fix globals.css common agent mistakes ──────────────────────────────────

/**
 * Fix common CSS mistakes agents make in globals.css:
 * 1. @apply inside @keyframes → replace with raw CSS
 * 2. Invalid Tailwind classes in @apply (clip-path-inset, etc.)
 * 3. Color-shade CSS vars (--color-primary-600) → remove (keep base only)
 * 4. Color-shade references in @apply (from-primary-600) → fix
 */
export function fixGlobalsCss(siteDir: string): void {
  const globalsCss = join(siteDir, "src", "app", "globals.css");
  if (!existsSync(globalsCss)) return;

  let css = readFileSync(globalsCss, "utf-8");
  const original = css;

  // 1. Replace @apply inside @keyframes with raw CSS equivalents
  css = css.replace(/@keyframes\s+[\w-]+\s*\{[\s\S]*?\n\}/g, (match) => {
    if (!match.includes("@apply")) return match;
    return match.replace(/@apply\s+([^;]+);/g, (_, classes) => {
      // Convert common @apply classes to raw CSS
      const cssProps: string[] = [];
      const classStr = classes.trim();
      if (classStr.includes("opacity-0")) cssProps.push("opacity: 0;");
      if (classStr.includes("opacity-100")) cssProps.push("opacity: 1;");
      if (classStr.includes("translate-y-4")) cssProps.push("transform: translateY(1rem);");
      if (classStr.includes("translate-y-0")) cssProps.push("transform: translateY(0);");
      if (classStr.includes("translate-x-4")) cssProps.push("transform: translateX(1rem);");
      if (classStr.includes("translate-x-0")) cssProps.push("transform: translateX(0);");
      if (classStr.includes("scale-95")) cssProps.push("transform: scale(0.95);");
      if (classStr.includes("scale-100")) cssProps.push("transform: scale(1);");
      if (cssProps.length === 0) return "/* removed invalid @apply */";
      return cssProps.join(" ");
    });
  });

  // 2. Remove invalid Tailwind classes from @apply
  const invalidClasses = ["clip-path-inset", "clip-inset", "clip-path"];
  for (const cls of invalidClasses) {
    css = css.replace(new RegExp(`\\b${escapeRegex(cls)}\\b`, "g"), "");
  }
  // Clean up double spaces left by removal
  css = css.replace(/@apply\s+;/g, "/* removed empty @apply */");
  css = css.replace(/@apply\s{2,}/g, "@apply ");

  // 3. Remove numbered color-shade CSS vars from @theme (keep base only)
  // e.g. --color-primary-600: #xxx; → remove (--color-primary stays)
  css = css.replace(/\s*--color-(?:primary|secondary|accent|muted|destructive)-\d{2,3}:\s*[^;]+;\s*/g, "\n");

  // 4. Fix color-shade references in @apply (from-primary-600 → from-primary)
  const customColors = ["primary", "secondary", "accent", "muted", "destructive"];
  for (const color of customColors) {
    const shadeRegex = new RegExp(
      `((?:bg|text|border|ring|from|to|via|fill|stroke|divide|decoration)-${color})-\\d{2,3}`,
      "g"
    );
    css = css.replace(shadeRegex, "$1");
  }

  // 5. Clean up empty lines
  css = css.replace(/\n{3,}/g, "\n\n");

  if (css !== original) {
    writeFileSync(globalsCss, css, "utf-8");
    console.log("[BuildUtils] Fixed globals.css (@keyframes, invalid classes, color shades)");
  }
}
