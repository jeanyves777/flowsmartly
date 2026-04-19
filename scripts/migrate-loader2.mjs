#!/usr/bin/env node
/**
 * Migrate every `Loader2` usage to `AISpinner` (the shared, brand-consistent spinner
 * exported from `@/components/shared/ai-generation-loader`).
 *
 *   node scripts/migrate-loader2.mjs            # dry run, prints diff
 *   node scripts/migrate-loader2.mjs --apply    # writes changes
 *
 * Rules:
 * - Remove `Loader2` from any lucide-react named import (and collapse a single-name
 *   import into a deletion of the whole statement).
 * - If `AISpinner` is not already imported in the file, add an import from
 *   `@/components/shared/ai-generation-loader` directly after the existing
 *   lucide-react import (or at the top of the other imports).
 * - Replace every `Loader2` symbol reference with `AISpinner`.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const APPLY = process.argv.includes("--apply");

const SPINNER_IMPORT =
  'import { AISpinner } from "@/components/shared/ai-generation-loader";';

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === "generated-stores" || e.name === "generated-sites") continue;
      out.push(...(await walk(p)));
    } else if (e.isFile() && /\.(tsx?|jsx?)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function removeLoader2FromImport(source) {
  // Match lucide-react named imports spanning one or more lines.
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["'];?/g;
  return source.replace(importRegex, (match, names) => {
    const parts = names
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const filtered = parts.filter((p) => p !== "Loader2" && !p.startsWith("Loader2 as"));
    if (filtered.length === 0) return ""; // drop the whole statement
    if (filtered.length === parts.length) return match; // no change
    return `import { ${filtered.join(", ")} } from "lucide-react";`;
  });
}

function replaceLoader2Symbol(source) {
  // Replace word-boundary Loader2 references that are not preceded by `AI` (avoid
  // breaking `Loader2Icon` etc — doesn't exist in the codebase but be safe).
  return source.replace(/\bLoader2\b/g, "AISpinner");
}

function ensureAISpinnerImport(source) {
  if (/from\s*["']@\/components\/shared\/ai-generation-loader["']/.test(source)) {
    // Already imports from that module; check if AISpinner is already named.
    if (/import\s*\{[^}]*\bAISpinner\b[^}]*\}\s*from\s*["']@\/components\/shared\/ai-generation-loader["']/.test(source)) {
      return source;
    }
    // Add AISpinner to the existing import.
    return source.replace(
      /import\s*\{([^}]*)\}\s*from\s*["']@\/components\/shared\/ai-generation-loader["'];?/,
      (m, names) => {
        const parts = names.split(",").map((p) => p.trim()).filter(Boolean);
        parts.push("AISpinner");
        return `import { ${parts.join(", ")} } from "@/components/shared/ai-generation-loader";`;
      }
    );
  }

  // Find the END of the last top-level import (the line that closes it —
  // either a single-line `import ... from "..."` or the closing line of a
  // multi-line `import { ... } from "..."`). The grammar rule: an import
  // statement ends on a line matching `from "..."` or on an inline
  // single-line import. Track the deepest nesting of braces.
  const lines = source.split("\n");
  let inImport = false;
  let braceDepth = 0;
  let lastImportEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inImport) {
      if (/^\s*import\s/.test(line)) {
        inImport = true;
        braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        // Single-line import ends on the same line if it contains `from`
        if (braceDepth <= 0 && /\bfrom\s*["']/.test(line)) {
          lastImportEnd = i;
          inImport = false;
          braceDepth = 0;
        }
      }
    } else {
      braceDepth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && /\bfrom\s*["']/.test(line)) {
        lastImportEnd = i;
        inImport = false;
        braceDepth = 0;
      }
    }
  }

  if (lastImportEnd === -1) {
    // No imports in file at all — put at the very top.
    return `${SPINNER_IMPORT}\n${source}`;
  }
  lines.splice(lastImportEnd + 1, 0, SPINNER_IMPORT);
  return lines.join("\n");
}

async function main() {
  const files = await walk(ROOT);
  let touched = 0;
  let changedFiles = 0;

  for (const file of files) {
    const original = await fs.readFile(file, "utf8");
    if (!/\bLoader2\b/.test(original)) continue;

    // Skip the AI generation loader component itself (defines/exports — not a consumer).
    if (file.endsWith(path.join("shared", "ai-generation-loader.tsx"))) continue;

    // Skip template files whose strings become source code for GENERATED stores/sites.
    // Those projects don't have AISpinner and must keep lucide-react's Loader2.
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (rel.startsWith("lib/store-builder/templates/") || rel.startsWith("lib/website/templates/")) continue;

    let updated = removeLoader2FromImport(original);
    updated = replaceLoader2Symbol(updated);

    if (/\bAISpinner\b/.test(updated) && !/from\s*["']@\/components\/shared\/ai-generation-loader["']/.test(updated)) {
      updated = ensureAISpinnerImport(updated);
    } else if (/\bAISpinner\b/.test(updated)) {
      updated = ensureAISpinnerImport(updated);
    }

    // Clean up any blank lines left behind by import collapse
    updated = updated.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");

    if (updated !== original) {
      changedFiles += 1;
      const matches = (original.match(/\bLoader2\b/g) || []).length;
      touched += matches;
      if (APPLY) {
        await fs.writeFile(file, updated, "utf8");
        process.stdout.write(`✓ ${path.relative(ROOT, file)} (${matches} refs)\n`);
      } else {
        process.stdout.write(`~ ${path.relative(ROOT, file)} (${matches} refs)\n`);
      }
    }
  }

  const verb = APPLY ? "updated" : "would update";
  process.stdout.write(`\n${changedFiles} files ${verb}, ${touched} Loader2 references replaced.\n`);
  if (!APPLY) process.stdout.write("(dry run — re-run with --apply to write changes)\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
