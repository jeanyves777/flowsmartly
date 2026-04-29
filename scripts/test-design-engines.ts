/**
 * Smoke test for the new flat + editable design engine agents.
 *
 * Run locally with:
 *   npx tsx scripts/test-design-engines.ts
 *
 * The script exercises both agents against a sample brief. Final
 * artifacts land in tmp/ for visual inspection. Telemetry (iterations,
 * tools used, critique scores) prints to stdout.
 *
 * NOT intended for CI — it makes real API calls to OpenAI + Anthropic
 * which cost money. ~$0.50-1.50 per full run depending on iterations.
 *
 * Pre-flight:
 *   - OPENAI_API_KEY + ANTHROPIC_API_KEY set in .env or env.
 *   - rembg installed (Python u2net) for the editable agent's bg
 *     removal pre-step. If not, the test still runs but the agent
 *     handles the missing tool gracefully.
 */

import "dotenv/config";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { runFlatImageAgent, type FlatImageBrief } from "../src/lib/ai/flat-image-agent";
import { runEditableDesignAgent, type EditableDesignBrief } from "../src/lib/ai/editable-design-agent";
import { runVideoAgent, type VideoBrief } from "../src/lib/ai/video-agent";

const TMP_DIR = path.join(process.cwd(), "tmp", "design-engine-test");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function sharedBriefBase() {
  return {
    category: "social_post",
    topic: "Sunday Revelation Service flyer for Laikos International Church Albany",
    designText: [
      "HEADLINE: Sunday Revelation Service",
      "SUBHEAD: Every Sunday at 10:00 AM",
      "TAGLINE: Jesus Saviour of the World",
      "BRAND: Laikos International Church Albany",
      "ADDRESS: 255 N. Allen Street, Albany, NY 12206",
      "PHONE: +1 518-892-7731",
      "CTA: All are welcome — come as you are",
    ].join("\n"),
    width: 1080,
    height: 1350,
    brand: {
      name: "Laikos International Church Albany",
      voiceTone: "warm, inviting, reverent",
      primary: "#1a5f3f",
      secondary: "#88c057",
      accent: "#fbbf24",
      fonts: { heading: "Playfair Display", body: "Lato" },
    },
    vibe: "warm, joyful, modern but reverent",
  };
}

async function testFlatAgent() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("Test 1: Flat Image Agent");
  console.log("══════════════════════════════════════════════════");

  const brief: FlatImageBrief = sharedBriefBase();
  // Optional: set TEST_REFERENCE_URL to test the photo-composite path.
  const refUrl = process.env.TEST_REFERENCE_URL;
  if (refUrl) brief.referenceImageUrl = refUrl;

  const t0 = Date.now();
  try {
    const result = await runFlatImageAgent(brief);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const outFile = path.join(TMP_DIR, `flat-${Date.now()}.png`);
    const b64 = result.imageDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    await writeFile(outFile, Buffer.from(b64, "base64"));

    console.log(`✓ FLAT done in ${elapsed}s`);
    console.log(`  iterations: ${result.iterations}`);
    console.log(`  tools used: ${result.toolsUsed.join(", ")}`);
    console.log(`  critique log: ${JSON.stringify(result.critiqueLog)}`);
    if (typeof result.totalCostUsd === "number") {
      console.log(`  cost: $${result.totalCostUsd.toFixed(4)}`);
    }
    console.log(`  size: ${result.width}×${result.height}`);
    console.log(`  artifact: ${outFile}`);
    return { ok: true, file: outFile };
  } catch (err) {
    console.error("✗ FLAT failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function testEditableAgent() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("Test 2: Editable Design Agent");
  console.log("══════════════════════════════════════════════════");

  const brief: EditableDesignBrief = sharedBriefBase();
  const refUrl = process.env.TEST_REFERENCE_URL;
  if (refUrl) brief.referenceImageUrl = refUrl;

  const t0 = Date.now();
  try {
    const result = await runEditableDesignAgent(brief);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const outImg = path.join(TMP_DIR, `editable-${Date.now()}.png`);
    const outCanvas = path.join(TMP_DIR, `editable-${Date.now()}.canvas.json`);
    const b64 = result.imageDataUrl.replace(/^data:image\/[^;]+;base64,/, "");
    await writeFile(outImg, Buffer.from(b64, "base64"));
    await writeFile(outCanvas, JSON.stringify(result.canvas, null, 2));

    console.log(`✓ EDITABLE done in ${elapsed}s`);
    console.log(`  iterations: ${result.iterations}`);
    console.log(`  tools used: ${result.toolsUsed.join(", ")}`);
    console.log(`  critique log: ${JSON.stringify(result.critiqueLog)}`);
    if (typeof result.totalCostUsd === "number") {
      console.log(`  cost: $${result.totalCostUsd.toFixed(4)}`);
    }
    console.log(`  size: ${result.width}×${result.height}`);
    console.log(`  Fabric objects: ${result.canvas.objects.length}`);
    console.log(`  preview: ${outImg}`);
    console.log(`  canvas: ${outCanvas}`);
    return { ok: true, file: outImg, canvas: outCanvas };
  } catch (err) {
    console.error("✗ EDITABLE failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function testVideoAgent() {
  console.log("\n══════════════════════════════════════════════════");
  console.log("Test 3: Video Agent (Veo 3.1)");
  console.log("══════════════════════════════════════════════════");

  const brief: VideoBrief = {
    topic: "Sunday Revelation Service announcement reel",
    shotDescription: "Warm cinematic establishing shot of a small church congregation at golden hour, soft sun rays through stained glass, slow dolly-in on a smiling pastor at the pulpit. Reverent, joyful mood.",
    aspectRatio: "9:16",
    durationSeconds: 6,
    brand: {
      name: "Laikos International Church Albany",
      voiceTone: "warm, inviting, reverent",
      primary: "#1a5f3f",
      secondary: "#88c057",
      accent: "#fbbf24",
    },
    vibe: "warm, joyful, modern but reverent",
  };
  if (process.env.TEST_REFERENCE_URL) brief.referenceImageUrl = process.env.TEST_REFERENCE_URL;

  const t0 = Date.now();
  try {
    const result = await runVideoAgent(brief);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`✓ VIDEO done in ${elapsed}s`);
    console.log(`  iterations: ${result.iterations}`);
    console.log(`  tools used: ${result.toolsUsed.join(", ")}`);
    console.log(`  videoUrl: ${result.videoUrl}`);
    console.log(`  jobId: ${result.jobId}`);
    console.log(`  model: ${result.model}`);
    return { ok: true, ...result };
  } catch (err) {
    console.error("✗ VIDEO failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  await ensureDir(TMP_DIR);
  console.log(`Output dir: ${TMP_DIR}`);
  console.log(`Reference URL: ${process.env.TEST_REFERENCE_URL || "(none — skipping reference photo path)"}`);

  const which = (process.argv[2] || "all").toLowerCase();
  const flat = which === "all" || which === "flat";
  const editable = which === "all" || which === "editable";
  const video = which === "all" || which === "video";

  const results: Record<string, unknown> = {};
  if (flat) results.flat = await testFlatAgent();
  if (editable) results.editable = await testEditableAgent();
  if (video) results.video = await testVideoAgent();

  console.log("\n══════════════════════════════════════════════════");
  console.log("Summary");
  console.log("══════════════════════════════════════════════════");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
