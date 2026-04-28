/**
 * Post-process composite JSONs — extract `data:image/...` URLs into
 * standalone PNG files in /public/templates/composites/, replacing
 * the src with a relative URL. Keeps the JSONs small (~10KB each) and
 * lets the browser cache the static image assets.
 *
 * Idempotent — running twice produces the same outputs.
 *
 *   npx tsx scripts/extract-composite-data-urls.ts
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const COMPOSITES_DIR = path.resolve(process.cwd(), "public/templates/composites");

async function main() {
  const files = (await fs.readdir(COMPOSITES_DIR)).filter((f) => f.endsWith(".json"));
  console.log(`[extract] processing ${files.length} composites in ${COMPOSITES_DIR}`);

  let totalExtracted = 0;
  let totalBytesBefore = 0;
  let totalBytesAfter = 0;

  for (const file of files) {
    const fullPath = path.join(COMPOSITES_DIR, file);
    const id = file.replace(/\.json$/, "");
    const raw = await fs.readFile(fullPath, "utf8");
    totalBytesBefore += Buffer.byteLength(raw, "utf8");

    let extractedThisFile = 0;
    const transformed = await transformJson(raw, id, () => {
      extractedThisFile += 1;
    });

    await fs.writeFile(fullPath, transformed, "utf8");
    totalBytesAfter += Buffer.byteLength(transformed, "utf8");
    if (extractedThisFile > 0) {
      console.log(`  ✓  ${id} — extracted ${extractedThisFile} image${extractedThisFile > 1 ? "s" : ""} · ${Math.round(Buffer.byteLength(raw, "utf8") / 1024)}KB → ${Math.round(Buffer.byteLength(transformed, "utf8") / 1024)}KB`);
      totalExtracted += extractedThisFile;
    } else {
      console.log(`  ⏭  ${id} — no embedded data URLs`);
    }
  }

  const reduction = totalBytesBefore - totalBytesAfter;
  console.log(
    `[extract] DONE — extracted ${totalExtracted} images · ${Math.round(totalBytesBefore / 1024)}KB → ${Math.round(totalBytesAfter / 1024)}KB (saved ${Math.round(reduction / 1024)}KB)`,
  );
}

/**
 * Walk a JSON string, find any string value that starts with
 * `data:image/...;base64,`, write it out as a PNG file, replace it
 * with a public-relative URL.
 */
async function transformJson(raw: string, id: string, onExtract: () => void): Promise<string> {
  // We re-serialize after walking the parsed object — preserves field
  // order well enough for our use case.
  const parsed = JSON.parse(raw);
  await walk(parsed, id, onExtract);
  return JSON.stringify(parsed, null, 2);
}

const DATA_URL_RE = /^data:image\/([a-z+]+);base64,([A-Za-z0-9+/=]+)$/i;

async function walk(node: unknown, id: string, onExtract: () => void): Promise<void> {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) await walk(item, id, onExtract);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      const m = DATA_URL_RE.exec(value);
      if (m) {
        const ext = m[1].toLowerCase().replace("+xml", "").slice(0, 4);
        const buffer = Buffer.from(m[2], "base64");
        // Hash the bytes — same image referenced twice (e.g. shared bg)
        // gets one file. Short hash to keep filenames legible.
        const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 12);
        const filename = `${id}-${hash}.${ext === "jpeg" ? "jpg" : ext}`;
        const outPath = path.join(COMPOSITES_DIR, filename);
        try {
          await fs.access(outPath);
        } catch {
          await fs.writeFile(outPath, buffer);
        }
        obj[key] = `/templates/composites/${filename}`;
        onExtract();
      }
    } else if (typeof value === "object") {
      await walk(value, id, onExtract);
    }
  }
}

main().catch((err) => {
  console.error("[extract] fatal:", err);
  process.exit(1);
});
