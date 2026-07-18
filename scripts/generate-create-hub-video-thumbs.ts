import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const raw = await readFile(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] ||= value;
  }
}

const outputs = [
  {
    file: "video-studio-spy-chase.mp4",
    prompt: [
      "Eight-second cinematic action movie clip, original character only, not based on any existing franchise or actor.",
      "A sharply dressed modern spy sprints from the glittering entrance of a luxury casino toward a grand hotel across a rain-slick boulevard at night, chasing a mysterious bad guy in a black coat.",
      "Dynamic handheld chase camera, neon reflections, elegant sports cars passing, tense but polished, PG-13, no blood, no logos, no watermark.",
      "Native audio: footsteps, city ambience, cinematic percussion. The spy says clearly while running: \"You can create these videos too.\"",
      "One continuous shot, 16:9, premium realistic film look, usable as a menu thumbnail.",
    ].join(" "),
  },
  {
    file: "video-studio-forest-warrior.mp4",
    prompt: [
      "Eight-second 3D animated fantasy movie clip, original character only, not based on any existing franchise or actor.",
      "A muscular bronze-age warrior with dark hair and leather armor stands in an ancient misty forest, defending himself as a roaring lion lunges from the ferns.",
      "The warrior dodges and raises a broad sword defensively, powerful heroic motion, dramatic shafts of sunlight, polished AAA 3D animation, PG-13, no gore, no logos, no watermark.",
      "Native audio: forest ambience, lion roar, cinematic drums. The warrior says clearly: \"You can create these too.\"",
      "One continuous shot, 16:9, highly readable composition, usable as a menu thumbnail.",
    ].join(" "),
  },
];

async function main() {
  await loadLocalEnv();
  const { grokVideoClient } = await import("../src/lib/ai/grok-video-client");

  if (!grokVideoClient.isAvailable()) {
    throw new Error("XAI_API_KEY is not configured in this environment.");
  }

  const outDir = path.resolve(process.cwd(), "public", "create-hub-video-thumbs");
  await mkdir(outDir, { recursive: true });

  for (const item of outputs) {
    console.log(`\n[create-hub] Generating ${item.file}`);
    const result = await grokVideoClient.generateVideo(item.prompt, {
      duration: 8,
      aspectRatio: "16:9",
      resolution: "720p",
      timeoutMs: 900000,
      onStatus: (message) => console.log(`[create-hub] ${message}`),
      onJobId: (requestId) => console.log(`[create-hub] job=${requestId}`),
    });

    const outputPath = path.join(outDir, item.file);
    await writeFile(outputPath, result.videoBuffer);
    console.log(`[create-hub] Saved ${outputPath} (${result.videoBuffer.length} bytes, provider duration=${result.duration}s)`);
  }
}

main().catch((error) => {
  console.error("[create-hub] Failed:", error);
  process.exit(1);
});
