/**
 * Dev tool — generate short marketing videos with the app's own Grok video
 * client (xAI grok-imagine-video) and save them under
 * public/marketing/generated/*.mp4.
 *
 * Usage (from repo root):
 *   npx tsx scripts/gen-marketing-video.ts             # all jobs
 *   npx tsx scripts/gen-marketing-video.ts hero-demo   # only matching job(s)
 *
 * Requires XAI_API_KEY in .env / .env.local. Jobs poll up to ~10 min each.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
for (const f of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(path.join(ROOT, f), "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch { /* file may not exist */ }
}

const OUT_DIR = path.join(ROOT, "public/marketing/generated");

type Aspect = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";
type VideoJob = { name: string; aspect: Aspect; duration: number; prompt: string };

const CLEAN = "Cinematic, photorealistic, smooth camera motion, professional commercial quality, warm natural lighting, no on-screen text, no watermarks, no distorted faces or hands. IMPORTANT: any person stays naturally focused on their own screen and task for the ENTIRE clip and NEVER looks at the camera, never makes eye contact with the viewer, and never glances at the lens — candid, unaware-of-camera documentary feel.";
// Force a side/profile composition so the subject is physically turned to their
// screen and cannot face the lens (the reliable fix for the camera-gaze artifact).
const SIDE = "Filmed from a three-quarter SIDE angle: the person is seen from the side, turned toward their own laptop and looking DOWN at the screen — a side profile, clearly NOT facing the camera at any moment.";

const JOBS: VideoJob[] = [
  {
    name: "showcase-hero", aspect: "16:9", duration: 6,
    prompt: `A premium 6-second product marketing montage showing a small business coming to life: quick elegant cuts of a fresh bakery storefront, appetizing autumn pastries and a latte with steam, a smartphone showing a social post, and a laptop showing an online store. Cozy warm autumn palette, shallow depth of field, satisfying and aspirational. ${CLEAN}`,
  },
  {
    name: "showcase-ad", aspect: "9:16", duration: 6,
    prompt: `A 6-second vertical social-media video ad for a neighborhood bakery's fall promotion: slow appetizing pans over cinnamon rolls, pumpkin muffins and pecan pie, steam rising from coffee, warm cozy morning light through a window. Mouth-watering food commercial look. ${CLEAN}`,
  },

  // ── per-surface motion for the deep-dive pages (square, subtle realistic motion) ──
  {
    name: "surface-create", aspect: "1:1", duration: 5,
    prompt: `A focused creative designer at a laptop, gentle natural motion — looking down at the screen that glows with a colorful social-media design, soft studio light, clean minimal desk, soft neutral light background. ${SIDE} ${CLEAN}`,
  },
  {
    name: "surface-grow", aspect: "1:1", duration: 5,
    prompt: `A marketer at a bright desk looking down at a marketing analytics dashboard on a laptop and a smartphone, subtle confident motion, charts glowing on screen, soft neutral background. ${SIDE} ${CLEAN}`,
  },
  {
    name: "surface-publish", aspect: "1:1", duration: 5,
    prompt: `Close-up of a hand smoothly scrolling a smartphone through a polished social-media feed of brand posts, cozy modern setting, soft neutral background, gentle motion. ${CLEAN}`,
  },
  {
    name: "surface-sell", aspect: "1:1", duration: 5,
    prompt: `A small online-store owner at a laptop showing a modern storefront, looking down while calmly packing a small parcel beside it, warm light, clean desk, soft neutral background, subtle motion. ${SIDE} ${CLEAN}`,
  },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const filter = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const jobs = filter.length ? JOBS.filter((j) => filter.some((f) => j.name.includes(f))) : JOBS;
  if (!jobs.length) { console.error("No matching jobs for:", filter.join(", ")); process.exit(1); }

  const clientUrl = new URL("../src/lib/ai/grok-video-client.ts", import.meta.url).href;
  const { grokVideoClient } = await import(clientUrl);
  if (!grokVideoClient.isAvailable()) { console.error("Grok video client unavailable — set XAI_API_KEY"); process.exit(1); }

  for (const j of jobs) {
    const t0 = Date.now();
    try {
      console.log(`… generating ${j.name} (${j.duration}s ${j.aspect}) — this can take a few minutes`);
      const res = await grokVideoClient.generateVideo(j.prompt, {
        duration: j.duration, aspectRatio: j.aspect, resolution: "720p",
        onStatus: (m: string) => console.log(`   [${j.name}] ${m}`),
      });
      writeFileSync(path.join(OUT_DIR, `${j.name}.mp4`), res.videoBuffer);
      console.log(`✓ ${j.name}  ${(res.videoBuffer.length / 1024 / 1024).toFixed(2)}MB  ${Math.round((Date.now() - t0) / 1000)}s`);
    } catch (e) {
      console.log(`✗ ${j.name}: ${String(e instanceof Error ? e.message : e).slice(0, 220)}`);
    }
  }
  console.log("done →", path.relative(ROOT, OUT_DIR));
}

main();
