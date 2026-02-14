import { prisma } from "@/lib/db/client";
import { generateCartoonScript, type CartoonScript, type CartoonCharacter, type CartoonScene } from "./script-generator";
import { generateAllSceneImages, generateAllCharacterPreviews, type SceneImage, type CharacterPreview, type ImageProvider } from "./image-generator";
import { generateAllSceneAudio, type SceneAudio } from "./audio-generator";
import { compositeVideo, checkFFmpegAvailable, compositeVideoFallback, compositeAnimatedVideo } from "./video-compositor";
import { saveCharactersToLibrary, saveSceneBackgroundsToLibrary, saveVideoToLibrary } from "./media-saver";
import { animateSceneCharacters, isAnimationAvailable } from "./animated-drawings";
import { createAllTalkingHeads, isTalkingHeadAvailable, type TalkingHeadResult } from "./talking-head-generator";
import { flowImageClient } from "@/lib/ai/flow-image-client";
import { generateSoraVideo } from "./sora-video-generator";

export type CartoonStatus =
  | "PENDING"
  | "PROCESSING"
  | "SCRIPT_READY"
  | "AWAITING_APPROVAL" // User needs to review/approve characters before continuing
  | "APPROVED" // Characters approved, continue processing
  | "IMAGES_READY"
  | "AUDIO_READY"
  | "COMPOSITING"
  | "COMPLETED"
  | "FAILED";

/** Library character selection (from character browser) */
export interface LibraryCharacterSelection {
  libraryCharId: string;
  name: string;
  thumbnail: string;
  texturePath: string;
}

export interface ProcessCartoonOptions {
  jobId: string;
  storyPrompt: string;
  style: string;
  duration: number;
  existingCharacters?: CartoonCharacter[];
  imageProvider?: ImageProvider;
  selectedLibraryCharacters?: LibraryCharacterSelection[];
}

/**
 * Update job status and progress in database
 */
async function updateJobStatus(
  jobId: string,
  status: CartoonStatus,
  progress: number,
  currentStep?: string,
  additionalData?: Record<string, unknown>
): Promise<void> {
  await prisma.cartoonVideo.update({
    where: { id: jobId },
    data: {
      status,
      progress,
      currentStep,
      ...additionalData,
    },
  });
}

/**
 * Phase 1: Generate script, character previews, AND scene backgrounds
 * Then wait for user approval before animating.
 * This runs asynchronously after the API returns the job ID.
 */
export async function processCartoonVideoPhase1(options: ProcessCartoonOptions): Promise<void> {
  const { jobId, storyPrompt, style, duration, existingCharacters, imageProvider = "openai", selectedLibraryCharacters } = options;
  const hasLibraryChars = selectedLibraryCharacters && selectedLibraryCharacters.length > 0;

  try {
    // Pre-check: verify Flow AI server is reachable (only needed for character previews — backgrounds use canvas)
    if (imageProvider === "flow" && !hasLibraryChars) {
      const available = await flowImageClient.isAvailable();
      if (!available) {
        throw new Error("Flow AI server is not available. Please make sure the Docker container is running.");
      }
    }

    // Load existing job data for resume support (picks up from previous failed attempts)
    const existingJob = await prisma.cartoonVideo.findUnique({
      where: { id: jobId },
      select: { script: true, sceneImages: true },
    });

    let existingScript: CartoonScript | null = null;
    let existingSceneImages: SceneImage[] = [];

    if (existingJob?.script) {
      try { existingScript = JSON.parse(existingJob.script); } catch { /* ignore */ }
    }
    if (existingJob?.sceneImages) {
      try { existingSceneImages = JSON.parse(existingJob.sceneImages); } catch { /* ignore */ }
    }

    // Step 1: Generate Script with Characters (0-10%)
    // Reuse existing script if available (resume support)
    let script: CartoonScript;
    if (existingScript && existingScript.scenes?.length > 0) {
      script = existingScript;
      console.log(`Resuming with existing script: "${script.title}" (${script.scenes.length} scenes, ${script.characters.length} characters)`);
    } else {
      await updateJobStatus(jobId, "PROCESSING", 5, "Generating story script and characters...");
      script = await generateCartoonScript(storyPrompt, style, duration, existingCharacters);
      // Save script immediately so it's not lost on failure
      await updateJobStatus(jobId, "PROCESSING", 10, "Script generated", {
        script: JSON.stringify(script),
      });
    }

    // Step 2: Map or Generate Character Preview Images (10-25%)
    let charactersWithPreviews: (CartoonCharacter & { libraryCharId?: string })[];

    if (hasLibraryChars) {
      // Library characters: map script characters to library characters by index
      // Each script character gets assigned a library character's texture as its preview
      await updateJobStatus(jobId, "PROCESSING", 15, "Assigning library characters...");

      charactersWithPreviews = script.characters.map((char, idx) => {
        const libChar = selectedLibraryCharacters![idx % selectedLibraryCharacters!.length];
        return {
          ...char,
          name: libChar.name, // Use the library character's (possibly customized) name
          previewUrl: libChar.texturePath, // Point to library texture.png
          libraryCharId: libChar.libraryCharId, // Track which library character is used
        };
      });

      // Also update character names in scenes to match library character names
      script.scenes = script.scenes.map(scene => ({
        ...scene,
        charactersInScene: scene.charactersInScene?.map((charName, idx) => {
          const scriptCharIdx = script.characters.findIndex(c => c.name.toLowerCase() === charName.toLowerCase());
          if (scriptCharIdx >= 0 && charactersWithPreviews[scriptCharIdx]) {
            return charactersWithPreviews[scriptCharIdx].name;
          }
          return charName;
        }),
        dialogue: scene.dialogue?.map(d => {
          const scriptCharIdx = script.characters.findIndex(c => c.name.toLowerCase() === d.character.toLowerCase());
          if (scriptCharIdx >= 0 && charactersWithPreviews[scriptCharIdx]) {
            return { ...d, character: charactersWithPreviews[scriptCharIdx].name };
          }
          return d;
        }),
      }));

      console.log(`Assigned ${selectedLibraryCharacters!.length} library characters to ${script.characters.length} script roles`);
    } else {
      // Original flow: generate AI character previews or use uploaded images
      const uploadedPreviewMap = new Map(
        (existingCharacters || [])
          .filter(c => c.previewUrl)
          .map(c => [c.name.toLowerCase(), c.previewUrl!])
      );

      const charsNeedingPreview = script.characters.filter(
        char => !uploadedPreviewMap.has(char.name.toLowerCase())
      );

      const existingCharPreviews: CharacterPreview[] = script.characters
        .filter(c => c.previewUrl)
        .map(c => ({ name: c.name, imageUrl: c.previewUrl! }));

      await updateJobStatus(jobId, "PROCESSING", 10,
        charsNeedingPreview.length > 0
          ? `Generating character previews (${charsNeedingPreview.length} of ${script.characters.length})...`
          : "Using uploaded character images..."
      );

      const characterPreviews = charsNeedingPreview.length > 0
        ? await generateAllCharacterPreviews(
            charsNeedingPreview,
            style,
            jobId,
            (completed, total) => {
              const previewProgress = 10 + Math.round((completed / total) * 15);
              updateJobStatus(
                jobId,
                "PROCESSING",
                previewProgress,
                `Generating character preview ${completed}/${total}...`
              ).catch(console.error);
            },
            imageProvider === "canvas" ? "openai" : imageProvider, // canvas provider is for backgrounds only
            existingCharPreviews,
            async (allPreviews) => {
              const updatedChars = script.characters.map(char => {
                const preview = allPreviews.find(p => p.name === char.name);
                return preview ? { ...char, previewUrl: preview.imageUrl } : char;
              });
              const scriptSnapshot = { ...script, characters: updatedChars };
              await updateJobStatus(jobId, "PROCESSING", 20, "Saving character preview...", {
                script: JSON.stringify(scriptSnapshot),
              });
            }
          )
        : [];

      charactersWithPreviews = script.characters.map(char => {
        const uploadedUrl = uploadedPreviewMap.get(char.name.toLowerCase());
        if (uploadedUrl) {
          return { ...char, previewUrl: uploadedUrl };
        }
        const preview = characterPreviews.find(p => p.name === char.name);
        return {
          ...char,
          previewUrl: preview?.imageUrl || null,
        };
      });
    }

    // Update script in memory with previews
    script = { ...script, characters: charactersWithPreviews };

    // Step 3: Generate Scene Background Images (25-50%)
    await updateJobStatus(jobId, "PROCESSING", 25, "Generating scene backgrounds...");

    const backgroundImages = await generateAllSceneImages(
      script.scenes,
      style,
      jobId,
      (completed, total) => {
        const bgProgress = 25 + Math.round((completed / total) * 25);
        updateJobStatus(
          jobId,
          "PROCESSING",
          bgProgress,
          `Generating background ${completed}/${total}...`
        ).catch(console.error);
      },
      script.characters, // Pass characters for environment context (not drawn)
      imageProvider,
      existingSceneImages,
      async (allImages) => {
        // Save scene images incrementally after each generation
        // Must be awaited to prevent race with AWAITING_APPROVAL status update
        await updateJobStatus(jobId, "PROCESSING", 30, "Saving scene background...", {
          sceneImages: JSON.stringify(allImages),
        });
      }
    );

    // Pause for character & background approval
    await updateJobStatus(jobId, "AWAITING_APPROVAL", 50, "Review your characters and scenes before continuing", {
      script: JSON.stringify(script),
      sceneImages: JSON.stringify(backgroundImages),
    });

    // Create notification for user to review characters
    const job = await prisma.cartoonVideo.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (job?.userId) {
      await prisma.notification.create({
        data: {
          userId: job.userId,
          type: "CARTOON_REVIEW",
          title: "Review your cartoon characters",
          message: `Your cartoon "${script.title}" has ${script.characters.length} characters and ${backgroundImages.length} scenes ready for review.`,
          actionUrl: `/cartoon-maker?id=${jobId}`,
        },
      });

      // Auto-save characters and backgrounds to media library immediately
      const projectName = script.title || `Cartoon ${jobId.slice(0, 8)}`;
      try {
        await saveCharactersToLibrary(job.userId, projectName, charactersWithPreviews);
        console.log("Characters auto-saved to media library");
      } catch (error) {
        console.error("Failed to auto-save characters to library:", error);
      }
      try {
        await saveSceneBackgroundsToLibrary(job.userId, projectName, backgroundImages);
        console.log("Scene backgrounds auto-saved to media library");
      } catch (error) {
        console.error("Failed to auto-save backgrounds to library:", error);
      }
    }
  } catch (error) {
    console.error("Cartoon script generation error:", error);
    await handleProcessingError(jobId, error);
  }
}

/**
 * Phase 2: Continue processing after character approval
 * Backgrounds are already generated in Phase 1 — this phase only does:
 * 1. Audio generation (TTS with character voices)
 * 2. SadTalker lip-sync animation
 * 3. AnimatedDrawings body animation
 * 4. FFmpeg compositing (background + animated characters + audio)
 */
export async function processCartoonVideoPhase2(
  jobId: string,
  approvedCharacters?: CartoonCharacter[]
): Promise<void> {
  try {
    const job = await prisma.cartoonVideo.findUnique({
      where: { id: jobId },
      select: { script: true, style: true, animationType: true, sceneImages: true, captionStyle: true, metadata: true },
    });

    if (!job?.script) {
      throw new Error("Script not found for job");
    }

    let script: CartoonScript = JSON.parse(job.script);

    // If user modified characters, update the script
    if (approvedCharacters && approvedCharacters.length > 0) {
      script.characters = approvedCharacters;
      await updateJobStatus(jobId, "APPROVED", 52, "Characters approved, generating audio...", {
        script: JSON.stringify(script),
      });
    } else {
      await updateJobStatus(jobId, "APPROVED", 52, "Characters approved, generating audio...");
    }

    // Check if this is a Sora job
    let jobImageProvider = "openai";
    try {
      const meta = JSON.parse(job.metadata || "{}");
      jobImageProvider = meta.imageProvider || "openai";
    } catch {}

    // ── Sora Pipeline ──────────────────────────────────────────────────────
    // When provider is Sora, skip normal background+animation flow.
    // Instead: generate audio → generate per-scene Sora video clips → concat.
    if (jobImageProvider === "sora") {
      // Step 1: Generate Audio
      await updateJobStatus(jobId, "PROCESSING", 55, "Recording dialogue...");
      const audioFiles = await generateAllSceneAudio(
        script.scenes,
        jobId,
        script.characters,
        (completed, total) => {
          const audioProgress = 55 + Math.round((completed / total) * 15);
          updateJobStatus(jobId, "PROCESSING", audioProgress,
            `Recording dialogue ${completed}/${total}...`
          ).catch(console.error);
        }
      );

      // Collect reference images from character previews for consistency
      const refPaths: string[] = [];
      for (const char of script.characters) {
        if (char.previewUrl) {
          const { resolveToLocalPath } = await import("@/lib/utils/s3-client");
          const localPath = await resolveToLocalPath(char.previewUrl);
          if (localPath) refPaths.push(localPath);
        }
      }

      // Step 2: Generate Sora video clips and assemble
      await updateJobStatus(jobId, "PROCESSING", 72, "Generating Sora video clips...");

      const soraResult = await generateSoraVideo({
        jobId,
        scenes: script.scenes,
        characters: script.characters,
        audioFiles,
        style: job.style,
        title: script.title,
        referenceImagePaths: refPaths,
        onProgress: (step, progress) => {
          const mappedProgress = 72 + Math.round((progress / 100) * 28);
          updateJobStatus(jobId, "PROCESSING", Math.min(mappedProgress, 99), step).catch(console.error);
        },
      });

      // Complete
      await updateJobStatus(jobId, "COMPLETED", 100, "Video ready!", {
        videoUrl: soraResult.videoUrl,
        thumbnailUrl: soraResult.thumbnailUrl,
        videoDuration: soraResult.durationSeconds,
        completedAt: new Date(),
      });

      // Save to library and notify
      const updatedJob = await prisma.cartoonVideo.findUnique({
        where: { id: jobId },
        select: { userId: true },
      });

      if (updatedJob?.userId) {
        try {
          await saveVideoToLibrary(
            updatedJob.userId,
            script.title || `Cartoon ${jobId.slice(0, 8)}`,
            soraResult.videoUrl,
            soraResult.thumbnailUrl,
            script.title || "Untitled Cartoon"
          );
        } catch (error) {
          console.error("Failed to save Sora video to library:", error);
        }

        await prisma.notification.create({
          data: {
            userId: updatedJob.userId,
            type: "CARTOON_COMPLETE",
            title: "Your cartoon is ready!",
            message: `Your Sora-generated cartoon "${script.title}" is ready to view.`,
            actionUrl: `/cartoon-maker?id=${jobId}`,
          },
        });
      }

      return; // Sora pipeline complete — skip normal flow
    }

    // ── Standard Pipeline ──────────────────────────────────────────────────
    // Retrieve background images generated in Phase 1
    const images: SceneImage[] = job.sceneImages ? JSON.parse(job.sceneImages) : [];
    if (images.length === 0) {
      throw new Error("No scene background images found — Phase 1 may not have completed");
    }

    // Step 1: Generate Audio with character voices (52-72%)
    const audioFiles = await generateAllSceneAudio(
      script.scenes,
      jobId,
      script.characters,
      (completed, total) => {
        const audioProgress = 52 + Math.round((completed / total) * 20);
        updateJobStatus(
          jobId,
          "PROCESSING",
          audioProgress,
          `Recording dialogue ${completed}/${total}...`
        ).catch(console.error);
      }
    );

    await updateJobStatus(jobId, "AUDIO_READY", 72, "Audio ready...", {
      audioFiles: JSON.stringify(audioFiles),
    });

    // Step 2: Generate talking head videos with SadTalker (lip sync + expressions)
    let talkingHeadResults: TalkingHeadResult[] = [];
    if (isTalkingHeadAvailable()) {
      await updateJobStatus(jobId, "PROCESSING", 73, "Generating talking face animations (SadTalker)...");

      // Use character preview images (not scene backgrounds) for SadTalker
      const talkingHeadScenes = script.scenes.map((scene) => {
        const sceneAudio = audioFiles.find(a => a.sceneNumber === scene.sceneNumber);
        const mainCharacter = scene.charactersInScene?.[0];
        const charPreview = mainCharacter
          ? script.characters.find(c => c.name === mainCharacter)?.previewUrl
          : null;

        return {
          sceneNumber: scene.sceneNumber,
          characterImageUrl: charPreview || "",
          audioUrl: sceneAudio?.audioUrl || "",
        };
      }).filter(s => s.characterImageUrl && s.audioUrl);

      talkingHeadResults = await createAllTalkingHeads(
        talkingHeadScenes,
        jobId,
        (completed, total) => {
          const progress = 73 + Math.round((completed / total) * 7);
          updateJobStatus(jobId, "PROCESSING", progress,
            `Generating talking face ${completed}/${total}...`
          ).catch(console.error);
        }
      );

      if (talkingHeadResults.length > 0) {
        console.log(`Generated ${talkingHeadResults.length} talking head videos`);
      }
    }

    // Step 3: Animate characters with AnimatedDrawings (if animated type)
    const isAnimated = job.animationType === "animated";
    let bodyAnimationResults: import("./animated-drawings").AnimationResult[] = [];

    if (isAnimated && isAnimationAvailable()) {
      await updateJobStatus(jobId, "PROCESSING", 80, "Animating characters with Meta AnimatedDrawings...");

      // Build character image map from previews (case-insensitive keys)
      // For library characters with libraryCharId, use texture.png path so Python
      // can find the pre-rigged char_cfg.yaml + mask.png in the same directory
      const characterImages = new Map<string, string>();
      for (const char of script.characters) {
        const charKey = char.name.toLowerCase();
        if ((char as any).libraryCharId) {
          // Library character: point to texture.png in the character directory
          characterImages.set(charKey, `/characters/${(char as any).libraryCharId}/texture.png`);
        } else if (char.previewUrl) {
          characterImages.set(charKey, char.previewUrl);
        }
      }

      // Animate each scene's characters and collect results
      for (const scene of script.scenes) {
        try {
          const results = await animateSceneCharacters(
            scene,
            characterImages,
            jobId,
            (msg) => {
              updateJobStatus(jobId, "PROCESSING", 82, msg).catch(console.error);
            }
          );
          bodyAnimationResults.push(...results);
        } catch (error) {
          console.error(`Failed to animate scene ${scene.sceneNumber}:`, error);
        }
      }

      if (bodyAnimationResults.length > 0) {
        console.log(`Generated ${bodyAnimationResults.length} body animations`);
      }
    }

    // Step 4: Composite Video with FFmpeg (88-100%)
    // Full pipeline: Background + Character Overlays (animated or static) + Audio
    await updateJobStatus(jobId, "COMPOSITING", 88, "Compositing final video...");

    const hasFFmpeg = await checkFFmpegAvailable();

    let videoResult;
    if (!hasFFmpeg) {
      videoResult = await compositeVideoFallback({
        jobId,
        scenes: script.scenes,
        images,
        audioFiles,
        title: script.title,
        captionStyle: job.captionStyle || "classic",
      });
    } else {
      // Use animated compositor with all available layers
      // Passes character previews so they can be overlaid on backgrounds
      videoResult = await compositeAnimatedVideo({
        jobId,
        scenes: script.scenes,
        images,
        audioFiles,
        title: script.title,
        captionStyle: job.captionStyle || "classic",
        animationType: isAnimated ? "animated" : "static",
        talkingHeads: talkingHeadResults,
        bodyAnimations: bodyAnimationResults,
        characters: script.characters,
      });
    }

    // Complete
    await updateJobStatus(jobId, "COMPLETED", 100, "Video ready!", {
      videoUrl: videoResult.videoUrl,
      thumbnailUrl: videoResult.thumbnailUrl,
      videoDuration: videoResult.durationSeconds,
      completedAt: new Date(),
    });

    // Get user ID for notifications and media library
    const updatedJob = await prisma.cartoonVideo.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });

    if (updatedJob?.userId) {
      // Characters & backgrounds already saved to library in Phase 1

      // Save video to media library
      try {
        await saveVideoToLibrary(
          updatedJob.userId,
          script.title || `Cartoon ${jobId.slice(0, 8)}`,
          videoResult.videoUrl,
          videoResult.thumbnailUrl,
          script.title || "Untitled Cartoon"
        );
        console.log("Video saved to media library");
      } catch (error) {
        console.error("Failed to save video to library:", error);
      }

      // Create notification for user
      await prisma.notification.create({
        data: {
          userId: updatedJob.userId,
          type: "CARTOON_COMPLETE",
          title: "Your cartoon is ready!",
          message: `Your cartoon "${script.title}" has been generated and is ready to view.`,
          actionUrl: `/cartoon-maker?id=${jobId}`,
        },
      });
    }
  } catch (error) {
    console.error("Cartoon processing error:", error);
    await handleProcessingError(jobId, error);
  }
}

/**
 * Handle processing errors with credit refund
 */
async function handleProcessingError(jobId: string, error: unknown): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

  await updateJobStatus(jobId, "FAILED", 0, undefined, {
    errorMessage,
  });

  // Refund credits on failure
  const job = await prisma.cartoonVideo.findUnique({
    where: { id: jobId },
    select: { userId: true, creditsCost: true },
  });

  if (job?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: job.userId },
      select: { aiCredits: true },
    });

    await prisma.$transaction([
      prisma.user.update({
        where: { id: job.userId },
        data: { aiCredits: { increment: job.creditsCost } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: job.userId,
          type: "REFUND",
          amount: job.creditsCost,
          balanceAfter: (user?.aiCredits || 0) + job.creditsCost,
          referenceType: "ai_cartoon",
          referenceId: jobId,
          description: `Refund for failed cartoon generation`,
        },
      }),
      prisma.notification.create({
        data: {
          userId: job.userId,
          type: "CARTOON_FAILED",
          title: "Cartoon generation failed",
          message: `We couldn't generate your cartoon. Your ${job.creditsCost} credits have been refunded.`,
          actionUrl: `/cartoon-maker`,
        },
      }),
    ]);
  }
}

/**
 * Legacy function - calls phase 1 for backwards compatibility
 * @deprecated Use processCartoonVideoPhase1 instead
 */
export async function processCartoonVideo(options: ProcessCartoonOptions): Promise<void> {
  return processCartoonVideoPhase1(options);
}

/**
 * Get job status with all details
 */
export async function getCartoonJobStatus(jobId: string, userId: string) {
  const job = await prisma.cartoonVideo.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    return null;
  }

  // Parse script to get characters if available
  let script: CartoonScript | null = null;
  if (job.script) {
    try {
      script = JSON.parse(job.script);
    } catch {
      // Ignore parse errors
    }
  }

  // Parse scene images (backgrounds generated in Phase 1)
  let sceneImages: SceneImage[] = [];
  if (job.sceneImages) {
    try {
      sceneImages = JSON.parse(job.sceneImages);
    } catch {
      // Ignore parse errors
    }
  }

  return {
    id: job.id,
    status: job.status as CartoonStatus,
    progress: job.progress,
    currentStep: job.currentStep,
    storyPrompt: job.storyPrompt,
    style: job.style,
    duration: job.duration,
    videoUrl: job.videoUrl,
    thumbnailUrl: job.thumbnailUrl,
    videoDuration: job.videoDuration,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
    // Include script data for character preview
    title: script?.title,
    characters: script?.characters || [],
    scenes: script?.scenes || [],
    sceneImages,
  };
}

/**
 * List user's cartoon videos
 */
export async function listCartoonVideos(userId: string, limit = 20) {
  return prisma.cartoonVideo.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      progress: true,
      storyPrompt: true,
      style: true,
      videoUrl: true,
      thumbnailUrl: true,
      videoDuration: true,
      createdAt: true,
      completedAt: true,
    },
  });
}

// Re-export types
export type { CartoonScript, CartoonScene, CartoonCharacter, DialogueLine } from "./script-generator";
export type { SceneImage } from "./image-generator";
export type { SceneAudio } from "./audio-generator";
