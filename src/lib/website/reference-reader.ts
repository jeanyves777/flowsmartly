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
 * Read a reference component file
 */
export function readReferenceComponent(name: string): string | null {
  const relativePath = COMPONENT_MAP[name];
  if (!relativePath) {
    return `Unknown component: ${name}. Available: ${Object.keys(COMPONENT_MAP).join(", ")}`;
  }

  const fullPath = join(REFERENCE_DIR, relativePath);
  try {
    return readFileSync(fullPath, "utf-8");
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
