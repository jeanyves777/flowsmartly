/**
 * Sync canonical template files from the reference-store seed to an existing
 * generated store. Used to retrofit UX fixes (image carousel, share button,
 * compact hero, etc.) into stores that were generated before the fix landed.
 *
 * Scope: only overwrites "component-like" template files. Does NOT touch
 * store-specific data (src/lib/data.ts, src/lib/products.ts), public/
 * uploaded images, API routes, or generated-stores-specific config. Anything
 * here is considered part of the unified template surface and will be
 * overwritten verbatim.
 *
 * Callers should follow up with triggerStoreRebuildIfV2(storeId) to rebuild
 * and redeploy the store.
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";

const REFERENCE_CANDIDATES = [
  "/opt/reference-store",
  "/opt/flowsmartly/reference-store",
];

const TEMPLATE_FILES: readonly string[] = [
  "src/lib/products-store.ts",
  "src/lib/cart.ts",
  "src/components/Hero.tsx",
  "src/components/Header.tsx",
  "src/components/Footer.tsx",
  "src/components/MobileBottomNav.tsx",
  "src/components/CartDrawer.tsx",
  "src/components/ProductCard.tsx",
  "src/components/CategoryShowcase.tsx",
  "src/components/FeaturedProducts.tsx",
  "src/components/Newsletter.tsx",
  "src/components/AboutSection.tsx",
  "src/components/ThemeProvider.tsx",
  "src/components/ThemeToggle.tsx",
  "src/components/AccountModal.tsx",
  "src/components/AccountModalProvider.tsx",
  "src/app/products/[slug]/ProductDetailClient.tsx",
];

/**
 * Canonical templates that may live at different paths in older generated
 * stores. Key is the source path in reference-store, value is a list of
 * alternative destination paths that — if they already exist in the store —
 * should also be overwritten with the same canonical content.
 */
const TEMPLATE_ALIASES: Record<string, readonly string[]> = {
  "src/app/products/[slug]/ProductDetailClient.tsx": [
    "src/components/ProductDetailClient.tsx",
  ],
};

export interface SyncResult {
  refDir: string | null;
  synced: string[];
  skipped: Array<{ file: string; reason: string }>;
}

async function resolveReferenceDir(): Promise<string | null> {
  for (const candidate of REFERENCE_CANDIDATES) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function syncStoreTemplates(storeDir: string): Promise<SyncResult> {
  const refDir = await resolveReferenceDir();
  const result: SyncResult = { refDir, synced: [], skipped: [] };

  if (!refDir) {
    result.skipped.push({
      file: "(all)",
      reason: "reference-store not found in known paths",
    });
    return result;
  }

  for (const rel of TEMPLATE_FILES) {
    const src = join(refDir, rel);
    const dst = join(storeDir, rel);

    try {
      await fs.stat(src);
    } catch {
      result.skipped.push({ file: rel, reason: "not present in reference-store" });
      continue;
    }

    try {
      await fs.mkdir(dirname(dst), { recursive: true });
      await fs.copyFile(src, dst);
      result.synced.push(rel);
    } catch (err) {
      result.skipped.push({
        file: rel,
        reason: err instanceof Error ? err.message : "copy failed",
      });
    }

    // Mirror to alias paths if the store uses a different layout
    const aliases = TEMPLATE_ALIASES[rel];
    if (aliases) {
      for (const aliasRel of aliases) {
        const aliasDst = join(storeDir, aliasRel);
        try {
          await fs.stat(aliasDst);
        } catch {
          continue; // alias doesn't exist in this store — nothing to mirror
        }
        try {
          await fs.copyFile(src, aliasDst);
          result.synced.push(aliasRel);
        } catch (err) {
          result.skipped.push({
            file: aliasRel,
            reason: err instanceof Error ? err.message : "alias copy failed",
          });
        }
      }
    }
  }

  return result;
}
