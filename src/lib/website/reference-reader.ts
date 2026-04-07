/**
 * Reference Component Reader
 * Reads component source code from the reference site for Claude to study and adapt.
 */

import { readFileSync } from "fs";
import { join } from "path";

// Reference site location
const REFERENCE_DIR = process.platform === "win32"
  ? "C:\\Users\\koffi\\Dev\\comptoirbativoir\\site\\src"
  : "/opt/comptoirbativoir/site/src";

const COMPONENT_MAP: Record<string, string> = {
  Header: "components/Header.tsx",
  Hero: "components/Hero.tsx",
  Stats: "components/Stats.tsx",
  About: "components/About.tsx",
  Services: "components/Services.tsx",
  Footer: "components/Footer.tsx",
  ContactSection: "components/ContactSection.tsx",
  GoogleReviews: "components/GoogleReviews.tsx",
  Partners: "components/Partners.tsx",
  Logo: "components/Logo.tsx",
  Announcements: "components/Announcements.tsx",
  ThemeProvider: "components/ThemeProvider.tsx",
  ThemeToggle: "components/ThemeToggle.tsx",
  // Pages
  HomePage: "app/page.tsx",
  Layout: "app/layout.tsx",
  GlobalCSS: "app/globals.css",
  Data: "lib/data.ts",
  ServicesPage: "app/services/page.tsx",
  AboutPage: "app/about/page.tsx",
  ContactPage: "app/contact/page.tsx",
  QuotePage: "app/quote/page.tsx",
};

/**
 * Read a reference component file, with automatic adaptation notes
 * for patterns that must be changed in generated sites.
 */
export function readReferenceComponent(name: string): string | null {
  const relativePath = COMPONENT_MAP[name];
  if (!relativePath) {
    return `Unknown component: ${name}. Available: ${Object.keys(COMPONENT_MAP).join(", ")}`;
  }

  const fullPath = join(REFERENCE_DIR, relativePath);
  try {
    let source = readFileSync(fullPath, "utf-8");

    // Add adaptation warnings for patterns that must change in generated sites
    const warnings: string[] = [];

    if (source.includes("next/link")) {
      warnings.push("ADAPT: This reference uses next/link <Link>. You MUST replace ALL <Link> with <a> tags using siteUrl() for href. Static export does not support next/link.");
    }
    if (source.includes("next/image")) {
      warnings.push("ADAPT: This reference uses next/image <Image>. You MUST replace with standard <img> tags. Static export does not support next/image optimization.");
    }
    if (source.includes("@tailwind base")) {
      warnings.push("ADAPT: This reference uses Tailwind v3 syntax. You MUST use Tailwind v4: @import \"tailwindcss\" instead of @tailwind directives.");
    }

    if (warnings.length > 0) {
      source = `/* ⚠️ ADAPTATION NOTES — read before copying:\n${warnings.map(w => ` * ${w}`).join("\n")}\n */\n\n${source}`;
    }

    return source;
  } catch (err) {
    console.error(`[RefReader] Failed to read ${fullPath}:`, err);
    return null;
  }
}

/**
 * Get list of available reference components
 */
export function getAvailableReferences(): string[] {
  return Object.keys(COMPONENT_MAP);
}
