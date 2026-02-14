import { openaiClient } from "@/lib/ai/openai-client";
import { flowImageClient } from "@/lib/ai/flow-image-client";
import { renderBackground } from "./canvas-background";
import { saveToFileLocal } from "@/lib/utils/file-storage";
import { uploadLocalFileToS3 } from "@/lib/utils/s3-client";
import path from "path";
import type { CartoonScene, CartoonCharacter } from "./script-generator";

export type ImageProvider = "openai" | "flow" | "canvas" | "sora";

export interface SceneImage {
  sceneNumber: number;
  imageUrl: string;
}

export interface CharacterPreview {
  name: string;
  imageUrl: string;
}

const STYLE_PROMPTS: Record<string, string> = {
  // 2D Styles
  anime: "anime style, Studio Ghibli inspired, vibrant colors, expressive 2D characters, detailed hand-drawn backgrounds, Japanese animation aesthetic, cel-shaded",
  comic: "comic book art style, bold black outlines, dynamic composition, vivid saturated colors, action-packed, 2D illustration",
  watercolor: "watercolor illustration style, soft brush strokes, pastel colors, storybook aesthetic, gentle and whimsical, 2D art",
  cartoon2d: "classic 2D cartoon style, hand-drawn animation look, clean lines, expressive characters, Disney/Cartoon Network inspired, traditional animation",
  flatdesign: "modern flat design illustration, simple geometric shapes, bold colors, minimal shading, vector art style, contemporary 2D graphics",
  // 3D Styles
  pixar: "Pixar 3D CGI animation style, colorful, friendly 3D characters, detailed CGI rendering, warm lighting, Disney-Pixar quality, subsurface scattering",
  clay: "claymation stop-motion style, clay texture, handcrafted 3D look, slightly imperfect surfaces, Wallace and Gromit inspired",
  lowpoly: "low polygon 3D art style, geometric shapes, stylized 3D graphics, flat shaded polygons, modern game art aesthetic",
};

/**
 * Generate a base64 image using the selected provider.
 */
async function generateWithProvider(
  prompt: string,
  provider: ImageProvider,
  options: {
    width: number;
    height: number;
    transparent?: boolean;
  }
): Promise<string | null> {
  if (provider === "flow") {
    return flowImageClient.generateImage(prompt, {
      width: Math.min(options.width, 384),   // Generate at 384, server upscales to 512
      height: Math.min(options.height, 384),
      steps: 12,                              // DPM++ 2M Karras converges in 12 steps
      guidanceScale: 7.5,
    });
  }

  // Default: OpenAI
  const sizeMap: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
    "1024x1024": "1024x1024",
    "1536x1024": "1536x1024",
    "1024x1536": "1024x1536",
  };
  const sizeKey = `${options.width}x${options.height}`;
  return openaiClient.generateImage(prompt, {
    size: sizeMap[sizeKey] || "auto",
    quality: "high",
    transparent: options.transparent,
  });
}

/**
 * Build environment context from scene characters (for background generation)
 */
function buildEnvironmentContext(
  scene: CartoonScene,
  characters?: CartoonCharacter[]
): string {
  if (!characters || characters.length === 0 || !scene.charactersInScene?.length) {
    return "";
  }

  // Mention how many characters are in the scene so the background has appropriate space
  return `\n\nNOTE: This scene features ${scene.charactersInScene.length} character(s) who will be composited separately. Leave open space in the foreground/center for character overlays.`;
}

/**
 * Generate a scene image using the selected provider
 */
export async function generateSceneImage(
  scene: CartoonScene,
  style: string,
  jobId: string,
  characters?: CartoonCharacter[],
  imageProvider: ImageProvider = "openai"
): Promise<SceneImage> {
  let base64: string | null;

  if (imageProvider === "canvas" || imageProvider === "flow") {
    // Programmatic canvas background — instant, no API calls, no credits
    // Flow AI also uses canvas for backgrounds (CPU inference too slow for scene images)
    base64 = await renderBackground(scene.visualDescription);
  } else {
    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.pixar;
    const envContext = buildEnvironmentContext(scene, characters);

    const prompt = `Create a SIMPLE, CLEAN background for an animated cartoon scene. Characters will be composited separately on top.

SCENE SETTING:
${scene.visualDescription}
${envContext}
STYLE:
${stylePrompt}

CRITICAL REQUIREMENTS:
- BACKGROUND ONLY - do NOT draw any characters, people, or creatures
- KEEP IT VERY SIMPLE AND CLEAN - like a whiteboard or simple 2D stage backdrop
- Use flat colors, minimal detail, and only a few essential objects/props
- Think simple 2D illustration with large open areas of solid or gradient color
- Only include 2-4 key objects that define the location (e.g., a tree, a house outline, a table)
- NO busy or cluttered scenes - lots of empty/negative space
- Large clear open area in the center/foreground for character overlays
- Soft, simple color palette - avoid overly detailed textures or patterns
- No text, no speech bubbles, no UI elements
- Suitable for a 16:9 video frame
- Consistent simple animation style throughout`;

    base64 = await generateWithProvider(prompt, imageProvider, {
      width: 1536,
      height: 1024,
      transparent: false,
    });
  }

  if (!base64) {
    throw new Error(`Failed to generate image for scene ${scene.sceneNumber}`);
  }

  // Save locally (for FFmpeg) and upload to S3 (for frontend)
  const dataUri = `data:image/png;base64,${base64}`;
  const filename = `${jobId}-scene-${scene.sceneNumber}.png`;
  const localUrl = await saveToFileLocal(dataUri, "cartoons", filename);
  const imageUrl = await uploadLocalFileToS3(
    path.join(process.cwd(), "public", localUrl),
    `cartoons/${filename}`
  );

  return {
    sceneNumber: scene.sceneNumber,
    imageUrl,
  };
}

/**
 * Generate all scene images (parallel for OpenAI, sequential for Flow AI on CPU)
 * Supports resume: pass existingImages to skip already-generated scenes.
 * Supports incremental save: onImageComplete is called after each successful generation.
 */
export async function generateAllSceneImages(
  scenes: CartoonScene[],
  style: string,
  jobId: string,
  onProgress?: (completed: number, total: number) => void,
  characters?: CartoonCharacter[],
  imageProvider: ImageProvider = "openai",
  existingImages?: SceneImage[],
  onImageComplete?: (allImages: SceneImage[]) => void | Promise<void>,
): Promise<SceneImage[]> {
  const total = scenes.length;
  let completed = 0;

  // Start with any existing images (resume support)
  const successfulImages: SceneImage[] = [...(existingImages || [])];

  // Determine which scenes still need generation
  const scenesNeeded = scenes.filter(
    (scene) => !successfulImages.some((img) => img.sceneNumber === scene.sceneNumber)
  );

  if (scenesNeeded.length === 0) {
    // All scenes already generated from a previous attempt
    return successfulImages.sort((a, b) => a.sceneNumber - b.sceneNumber);
  }

  // All providers now run in parallel:
  // - Canvas/Flow: use instant programmatic canvas backgrounds
  // - OpenAI: API handles concurrency
  const results = await Promise.allSettled(
    scenesNeeded.map(async (scene) => {
      const result = await generateSceneImage(scene, style, jobId, characters, imageProvider);
      completed++;
      onProgress?.(completed, total);
      return result;
    })
  );

  const newImages = results
    .filter((r): r is PromiseFulfilledResult<SceneImage> => r.status === "fulfilled")
    .map((r) => r.value);

  successfulImages.push(...newImages);
  if (newImages.length > 0) {
    await onImageComplete?.(successfulImages);
  }

  // We need at least 1 scene (or at least half for longer videos) to make a coherent video
  const minRequired = Math.max(1, Math.ceil(total / 2));
  if (successfulImages.length < minRequired) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => r.reason?.message || String(r.reason));
    const uniqueErrors = [...new Set(errors)];
    throw new Error(`Only ${successfulImages.length} of ${total} scene images were generated successfully. Errors: ${uniqueErrors.join("; ")}`);
  }

  return successfulImages.sort((a, b) => a.sceneNumber - b.sceneNumber);
}

/**
 * Generate a character portrait/preview image
 */
export async function generateCharacterPreview(
  character: CartoonCharacter,
  style: string,
  jobId: string,
  imageProvider: ImageProvider = "openai"
): Promise<CharacterPreview> {
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.pixar;

  const prompt = `Create a character illustration for an animated cartoon that will be used for AI animation.

CHARACTER:
- Name: ${character.name}
- Role: ${character.role}
- Description: ${character.description}
- Visual Appearance: ${character.visualAppearance}

STYLE:
${stylePrompt}

CRITICAL REQUIREMENTS (for AI animation compatibility):
- FULL BODY view from head to feet - the ENTIRE body must be visible
- Character must be FACING FORWARD (frontal view) looking directly at the viewer
- NEUTRAL STANDING POSE with arms slightly away from the body (not overlapping the torso)
- Arms and legs must be clearly separated from the body with visible gaps
- Face must be CLEARLY VISIBLE: eyes, nose, mouth all clearly defined and facing forward
- Character must be CENTERED in the frame with padding around all sides
- PLAIN SOLID COLOR or TRANSPARENT background - absolutely NO detailed backgrounds
- NO other characters, objects, or clutter in the image
- Clean silhouette - the character outline must be clearly distinguishable from background
- High quality, production-ready artwork
- No text, no labels, no UI elements
- The image will be used for: lip-sync face animation and full-body motion animation`;

  const base64 = await generateWithProvider(prompt, imageProvider, {
    width: 1024,
    height: 1024,
    transparent: true,
  });

  if (!base64) {
    throw new Error(`Failed to generate preview for character ${character.name}`);
  }

  // Save locally (for FFmpeg) and upload to S3 (for frontend)
  const dataUri = `data:image/png;base64,${base64}`;
  const safeName = character.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const filename = `${jobId}-char-${safeName}.png`;
  const localUrl = await saveToFileLocal(dataUri, "cartoons", filename);
  const imageUrl = await uploadLocalFileToS3(
    path.join(process.cwd(), "public", localUrl),
    `cartoons/${filename}`
  );

  return {
    name: character.name,
    imageUrl,
  };
}

/**
 * Generate preview images for all characters (parallel for OpenAI, sequential for Flow AI)
 * Supports resume: pass existingPreviews to skip already-generated characters.
 * Supports incremental save: onPreviewComplete is called after each successful generation.
 */
export async function generateAllCharacterPreviews(
  characters: CartoonCharacter[],
  style: string,
  jobId: string,
  onProgress?: (completed: number, total: number) => void,
  imageProvider: ImageProvider = "openai",
  existingPreviews?: CharacterPreview[],
  onPreviewComplete?: (allPreviews: CharacterPreview[]) => void | Promise<void>,
): Promise<CharacterPreview[]> {
  const total = characters.length;
  let completed = 0;

  // Start with any existing previews (resume support)
  const successfulPreviews: CharacterPreview[] = [...(existingPreviews || [])];

  // Determine which characters still need preview generation
  const charsNeeded = characters.filter(
    (char) => !successfulPreviews.some((p) => p.name === char.name)
  );

  if (charsNeeded.length === 0) {
    return successfulPreviews;
  }

  // Flow AI on CPU: run sequentially
  if (imageProvider === "flow") {
    for (const character of charsNeeded) {
      try {
        const result = await generateCharacterPreview(character, style, jobId, imageProvider);
        successfulPreviews.push(result);
        await onPreviewComplete?.(successfulPreviews);
      } catch (err) {
        console.error(`Flow AI character ${character.name} failed:`, err);
      }
      completed++;
      onProgress?.(completed, total);
    }
    return successfulPreviews;
  }

  // OpenAI: run in parallel
  const results = await Promise.allSettled(
    charsNeeded.map(async (character) => {
      const result = await generateCharacterPreview(character, style, jobId, imageProvider);
      completed++;
      onProgress?.(completed, total);
      return result;
    })
  );

  const newPreviews = results
    .filter((r): r is PromiseFulfilledResult<CharacterPreview> => r.status === "fulfilled")
    .map((r) => r.value);

  successfulPreviews.push(...newPreviews);
  if (newPreviews.length > 0) {
    await onPreviewComplete?.(successfulPreviews);
  }

  return successfulPreviews;
}
