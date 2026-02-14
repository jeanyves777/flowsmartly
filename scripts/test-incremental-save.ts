/**
 * Test script to verify incremental save + resume for cartoon pipeline.
 * Run with: npx tsx scripts/test-incremental-save.ts
 */
import { prisma } from "../src/lib/db/client";
import { processCartoonVideoPhase1 } from "../src/lib/cartoon/index";
import type { SceneImage, CharacterPreview } from "../src/lib/cartoon/image-generator";

async function main() {
  const userId = "cml497w990000vpy4zi33uk9e";

  // Create a test job
  const job = await prisma.cartoonVideo.create({
    data: {
      userId,
      storyPrompt: "A cat chases a mouse around a kitchen",
      style: "pixar",
      duration: 30,
      captionStyle: "classic",
      status: "PENDING",
      progress: 0,
      creditsCost: 0, // Free test
      metadata: JSON.stringify({ imageProvider: "flow" }),
    },
  });

  console.log(`\n=== Created test job: ${job.id} ===\n`);

  // Start Phase 1 processing (fire-and-forget style, just like real usage)
  console.log("Starting Phase 1 processing with Flow AI...");
  console.log("Will monitor DB for incremental saves...\n");

  // Start the pipeline in background
  const processingPromise = processCartoonVideoPhase1({
    jobId: job.id,
    storyPrompt: job.storyPrompt,
    style: job.style,
    duration: job.duration,
    imageProvider: "flow",
  });

  // Monitor the DB for changes every 30 seconds
  let lastProgress = -1;
  let lastSceneCount = -1;
  let lastScriptLen = -1;

  const monitor = setInterval(async () => {
    const current = await prisma.cartoonVideo.findUnique({
      where: { id: job.id },
      select: { status: true, progress: true, currentStep: true, script: true, sceneImages: true, errorMessage: true },
    });

    if (!current) return;

    const scriptLen = current.script?.length ?? 0;
    let sceneImages: SceneImage[] = [];
    try {
      sceneImages = current.sceneImages ? JSON.parse(current.sceneImages) : [];
    } catch {}

    // Only log when something changes
    if (current.progress !== lastProgress || sceneImages.length !== lastSceneCount || scriptLen !== lastScriptLen) {
      const charPreviews = current.script ? (() => {
        try {
          const s = JSON.parse(current.script!);
          return (s.characters || []).filter((c: { previewUrl?: string }) => c.previewUrl).length;
        } catch { return 0; }
      })() : 0;

      console.log(`[${new Date().toLocaleTimeString()}] Status=${current.status} Progress=${current.progress}% Step="${current.currentStep}" Script=${scriptLen > 0 ? 'YES' : 'NO'} CharPreviews=${charPreviews} SceneImages=${sceneImages.length}`);

      lastProgress = current.progress;
      lastSceneCount = sceneImages.length;
      lastScriptLen = scriptLen;
    }

    // Stop monitoring if done or failed
    if (["COMPLETED", "FAILED", "AWAITING_APPROVAL"].includes(current.status)) {
      clearInterval(monitor);

      if (current.status === "FAILED") {
        console.log(`\n=== FAILED: ${current.errorMessage} ===`);
        console.log(`But saved: Script=${scriptLen > 0 ? 'YES' : 'NO'}, SceneImages=${sceneImages.length}`);
        console.log("These will be reused on retry!\n");
      } else if (current.status === "AWAITING_APPROVAL") {
        console.log(`\n=== SUCCESS: Ready for approval! ===`);
        console.log(`Script saved, ${sceneImages.length} scene images saved`);
      }
    }
  }, 30000); // Check every 30 seconds

  // Wait for processing to complete
  try {
    await processingPromise;
    console.log("\nPhase 1 completed successfully!");
  } catch (err) {
    console.error("\nPhase 1 error:", err);
  }

  // Final check
  clearInterval(monitor);
  const final = await prisma.cartoonVideo.findUnique({
    where: { id: job.id },
    select: { status: true, progress: true, script: true, sceneImages: true, errorMessage: true },
  });

  let finalScenes: SceneImage[] = [];
  try { finalScenes = final?.sceneImages ? JSON.parse(final.sceneImages) : []; } catch {}

  let finalCharPreviews = 0;
  try {
    const s = final?.script ? JSON.parse(final.script) : null;
    finalCharPreviews = s?.characters?.filter((c: { previewUrl?: string }) => c.previewUrl)?.length ?? 0;
  } catch {}

  console.log("\n=== FINAL STATE ===");
  console.log(`Status: ${final?.status}`);
  console.log(`Progress: ${final?.progress}%`);
  console.log(`Script saved: ${(final?.script?.length ?? 0) > 0 ? 'YES' : 'NO'}`);
  console.log(`Character previews saved: ${finalCharPreviews}`);
  console.log(`Scene images saved: ${finalScenes.length}`);
  if (final?.errorMessage) console.log(`Error: ${final.errorMessage}`);

  console.log(`\nJob ID: ${job.id}`);
  console.log("You can retry this job from the UI or API if it failed.\n");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
