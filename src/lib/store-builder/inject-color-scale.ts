/**
 * Inject Tailwind v4 color scales into a store's globals.css.
 *
 * Our store generator only sets `--color-primary`, `--color-secondary`,
 * `--color-accent` — but our components are written against the full
 * Tailwind palette (primary-50, primary-600, primary-900/30, etc.). Without
 * the scale, those classes produce no CSS → invisible buttons, ghost text,
 * colorless accents.
 *
 * Solution: derive the scale from the single brand color using
 * `color-mix(in oklab, var(--color-primary) X%, white|black)`. This works in
 * modern browsers (94%+ coverage as of 2026) and keeps each store's palette
 * internally consistent.
 */
import { promises as fs } from "fs";
import { join } from "path";

const SCALE_BLOCK = `\n\n  /* Derived scale — let every Tailwind primary-50..900 class produce CSS. */\n  --color-primary-50: color-mix(in oklab, var(--color-primary) 8%, white);\n  --color-primary-100: color-mix(in oklab, var(--color-primary) 18%, white);\n  --color-primary-200: color-mix(in oklab, var(--color-primary) 36%, white);\n  --color-primary-300: color-mix(in oklab, var(--color-primary) 55%, white);\n  --color-primary-400: color-mix(in oklab, var(--color-primary) 75%, white);\n  --color-primary-500: var(--color-primary);\n  --color-primary-600: color-mix(in oklab, var(--color-primary) 88%, black);\n  --color-primary-700: color-mix(in oklab, var(--color-primary) 72%, black);\n  --color-primary-800: color-mix(in oklab, var(--color-primary) 55%, black);\n  --color-primary-900: color-mix(in oklab, var(--color-primary) 38%, black);\n\n  /* Same derivation for secondary + accent when the store defines them. */\n  --color-secondary-50: color-mix(in oklab, var(--color-secondary, var(--color-primary)) 8%, white);\n  --color-secondary-100: color-mix(in oklab, var(--color-secondary, var(--color-primary)) 18%, white);\n  --color-secondary-500: var(--color-secondary, var(--color-primary));\n  --color-secondary-600: color-mix(in oklab, var(--color-secondary, var(--color-primary)) 88%, black);\n  --color-secondary-700: color-mix(in oklab, var(--color-secondary, var(--color-primary)) 72%, black);\n  --color-secondary-900: color-mix(in oklab, var(--color-secondary, var(--color-primary)) 38%, black);\n\n  --color-accent-100: color-mix(in oklab, var(--color-accent, var(--color-primary)) 18%, white);\n  --color-accent-500: var(--color-accent, var(--color-primary));\n  --color-accent-600: color-mix(in oklab, var(--color-accent, var(--color-primary)) 88%, black);\n`;

const MARKER = "--color-primary-50:";

export async function injectColorScale(storeDir: string): Promise<boolean> {
  const cssPath = join(storeDir, "src", "app", "globals.css");
  let css: string;
  try {
    css = await fs.readFile(cssPath, "utf-8");
  } catch {
    return false;
  }

  if (css.includes(MARKER)) return false; // already injected

  // Find the @theme block containing --color-primary: and inject before its closing }
  const themeRegex = /(@theme\s*\{[^}]*--color-primary:[^}]*)\}/;
  if (!themeRegex.test(css)) return false;

  const next = css.replace(themeRegex, (_, head) => `${head}${SCALE_BLOCK}}`);
  await fs.writeFile(cssPath, next, "utf-8");
  return true;
}
