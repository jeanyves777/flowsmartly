/**
 * Pre-build editable composites for the 12 Featured Designs.
 *
 * Runs the existing template-reproduce-agent on each /public/templates/flyers/...
 * source JPEG and saves the resulting Fabric.js canvas JSON to
 * /public/templates/composites/{id}.json. The frontend's
 * FeaturedTemplatePreview modal then loads these JSONs directly into
 * the canvas — no AI call at user click time, no credit charge,
 * editable layers from the start.
 *
 * Cost: ~12 × ($0.05 Claude vision + ~$0.04 gpt-image-1 bg) ≈ $1-2
 * Runtime: ~5-10 min with concurrency 3.
 *
 * Usage:
 *   npx tsx scripts/build-featured-composites.ts
 *
 * Idempotent — skips templates whose JSON already exists unless --force.
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { reproduceTemplate } from "../src/lib/ai/template-reproduce-agent";

const FEATURED = [
  { id: "ft-bday-pastor-george",  imageUrl: "/templates/flyers/02463050-170e-4101-816d-22fd55ded341.jpeg" },
  { id: "ft-bday-honor-cruise",   imageUrl: "/templates/flyers/1292f0db-e038-4d0f-9c41-a1a3b9e414b7.jpeg" },
  { id: "ft-bday-polaroid-park",  imageUrl: "/templates/flyers/23aa436c-56ae-4d76-9f20-241f6b8e5955.jpeg" },
  { id: "ft-bday-polaroid-beach", imageUrl: "/templates/flyers/b86592d5-8935-447c-9b10-d18e0f2728d5.jpeg" },
  { id: "ft-bday-trio-yellow",    imageUrl: "/templates/flyers/fa1c35d0-2701-4329-a516-109e87b774ef.jpeg" },
  { id: "ft-bday-royal-blue",     imageUrl: "/templates/flyers/unnamed-2.jpg" },
  { id: "ft-bday-pastor-mike",    imageUrl: "/templates/flyers/IMG_9848.jpeg" },
  { id: "ft-event-tickets",       imageUrl: "/templates/flyers/IMG_9873.jpeg" },
  { id: "ft-event-countdown",     imageUrl: "/templates/flyers/5fa4cce9-3d09-4402-b745-03aa8f1d8f41.jpeg" },
  { id: "ft-event-tomorrow",      imageUrl: "/templates/flyers/unnamed-3.jpg" },
  { id: "ft-marketing-hero",      imageUrl: "/templates/flyers/IMG_9870.jpeg" },
  { id: "ft-product-luxury",      imageUrl: "/templates/flyers/IMG_9901.jpeg" },
];

const OUT_DIR = path.resolve(process.cwd(), "public/templates/composites");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 3;

async function buildOne(t: { id: string; imageUrl: string }): Promise<{ id: string; status: "ok" | "skipped" | "failed"; ms?: number; error?: string }> {
  const outPath = path.join(OUT_DIR, `${t.id}.json`);
  if (!FORCE) {
    try {
      await fs.access(outPath);
      console.log(`  ⏭  ${t.id} already exists (use --force to regenerate)`);
      return { id: t.id, status: "skipped" };
    } catch { /* doesn't exist — proceed */ }
  }

  console.log(`  ▶  ${t.id} — running reproduce agent…`);
  const t0 = Date.now();
  try {
    const result = await reproduceTemplate(t.imageUrl, {});
    const ms = Date.now() - t0;
    const json = JSON.stringify(
      {
        // Capture metadata so the frontend can preview info if needed.
        sourceImageUrl: t.imageUrl,
        generatedAt: new Date().toISOString(),
        canvas: result.canvas,
      },
      null,
      2,
    );
    await fs.writeFile(outPath, json, "utf8");
    console.log(`  ✓  ${t.id} — ${ms}ms · ${result.canvas.objects.length} layers · ${(json.length / 1024).toFixed(1)}KB`);
    return { id: t.id, status: "ok", ms };
  } catch (err) {
    const ms = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${t.id} — ${ms}ms · ${message}`);
    return { id: t.id, status: "failed", ms, error: message };
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log(`[composites] building ${FEATURED.length} templates → ${OUT_DIR}${FORCE ? " (force regen)" : ""}`);
  const t0 = Date.now();

  // Concurrency-limited fan-out.
  const queue = [...FEATURED];
  const results: Array<{ id: string; status: "ok" | "skipped" | "failed"; ms?: number; error?: string }> = [];
  async function worker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      results.push(await buildOne(next));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const total = Date.now() - t0;
  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed");
  console.log(`[composites] DONE — ${ok} new, ${skipped} skipped, ${failed.length} failed in ${(total / 1000).toFixed(1)}s`);
  if (failed.length > 0) {
    console.log("[composites] failures:");
    for (const f of failed) console.log(`  - ${f.id}: ${f.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[composites] fatal:", err);
  process.exit(1);
});
