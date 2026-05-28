import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES } from "@/lib/credits";
import { grokVideoClient } from "@/lib/ai/grok-video-client";
import { getPresignedUrl, uploadToS3 } from "@/lib/utils/s3-client";
import { getUserPreferredLanguage, languageDirective, getLanguageLabel } from "@/lib/ai/user-language";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { nanoid } from "nanoid";
import { spawn } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

export type StoryAdMovieAspectRatio = "9:16" | "1:1" | "16:9";
export type StoryAdMovieDuration = 10 | 20 | 30 | 40;
const STORY_AD_SECONDS_PER_CHAPTER = 10;
export const STORY_AD_CREDITS_PER_10_SECONDS = 100;

export interface StoryAdMovieInput {
  jobId: string;
  userId: string;
  brief: string;
  aspectRatio: StoryAdMovieAspectRatio;
  duration: StoryAdMovieDuration;
  style: string;
  goal?: string | null;
  destinationUrl?: string | null;
  platforms?: string[];
  referenceMediaUrls?: string[];
  referenceMedia?: StoryAdMovieReferenceMedia[];
  characterBrief?: string | null;
}

export interface StoryAdMovieReferenceMedia {
  url: string;
  scene?: string | null;
  note?: string | null;
  type?: "image" | "video" | "media" | null;
}

interface BrandSnapshot {
  name: string;
  tagline?: string | null;
  description?: string | null;
  industry?: string | null;
  niche?: string | null;
  targetAudience?: string | null;
  voiceTone?: string | null;
  website?: string | null;
  logo?: string | null;
  iconLogo?: string | null;
  personality: string[];
  keywords: string[];
  products: string[];
  uniqueValue?: string | null;
}

export interface StoryAdMovieScript {
  title: string;
  campaignCaption: string;
  ctaText: string;
  hashtags: string[];
  videoPrompt: string;
  scenes: StoryAdMovieScene[];
}

export interface StoryAdMovieScene {
  sceneNumber: number;
  narration: string;
  imagePrompt: string;
  caption?: string;
}

const STYLE_HINTS: Record<string, string> = {
  cinematic: "cinematic commercial, realistic lighting, premium camera movement, polished brand film",
  local_trust: "warm local business ad, human, trustworthy, clean neighborhood visuals",
  premium: "premium luxury commercial, elegant, minimal, high-end lighting and refined composition",
  social_bold: "bold social media ad, punchy visual contrast, energetic but clean",
  product_showcase: "product and service showcase, crisp commercial photography, clear benefits",
};

function parseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  currentStep?: string,
  additionalData?: Record<string, unknown>,
) {
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

async function getBrandSnapshot(userId: string): Promise<BrandSnapshot> {
  const [brand, user] = await Promise.all([
    prisma.brandKit.findFirst({
      where: { userId, isDefault: true },
    }).then((defaultBrand) =>
      defaultBrand || prisma.brandKit.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
    ),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    }),
  ]);

  if (!brand) {
    return {
      name: user?.name || user?.username || "Your brand",
      personality: [],
      keywords: [],
      products: [],
    };
  }

  return {
    name: brand.name,
    tagline: brand.tagline,
    description: brand.description,
    industry: brand.industry,
    niche: brand.niche,
    targetAudience: brand.targetAudience,
    voiceTone: brand.voiceTone,
    website: brand.website,
    logo: brand.logo,
    iconLogo: brand.iconLogo,
    personality: parseArray(brand.personality),
    keywords: parseArray(brand.keywords),
    products: parseArray(brand.products),
    uniqueValue: brand.uniqueValue,
  };
}

function normalizeAspectRatio(value: unknown): StoryAdMovieAspectRatio {
  return value === "1:1" || value === "16:9" || value === "9:16" ? value : "9:16";
}

function normalizeDuration(value: unknown): StoryAdMovieDuration {
  const numeric = Number(value);
  if (numeric <= 10) return 10;
  if (numeric <= 20) return 20;
  if (numeric <= 30) return 30;
  return 40;
}

export function calculateStoryAdMovieCredits(duration: StoryAdMovieDuration): number {
  return Math.ceil(duration / STORY_AD_SECONDS_PER_CHAPTER) * STORY_AD_CREDITS_PER_10_SECONDS;
}

function normalizeStringArray(value: unknown, max = 8): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
  )].slice(0, max);
}

function normalizeReferenceMedia(value: unknown): StoryAdMovieReferenceMedia[] {
  if (!Array.isArray(value)) return [];
  const normalized: StoryAdMovieReferenceMedia[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!url) continue;
    const rawType = typeof record.type === "string" ? record.type : null;
    normalized.push({
      url,
      scene: typeof record.scene === "string" ? record.scene.trim().slice(0, 120) : null,
      note: typeof record.note === "string" ? record.note.trim().slice(0, 400) : null,
      type: rawType === "image" || rawType === "video" || rawType === "media" ? rawType : null,
    });
  }
  return normalized.slice(0, 12);
}

export function normalizeStoryAdMovieInput(body: Record<string, unknown>) {
  const brief = String(body.brief || body.storyPrompt || "").trim();
  const referenceMedia = normalizeReferenceMedia(body.referenceMedia);
  const referenceMediaUrls = [
    ...normalizeStringArray(body.referenceMediaUrls, 10),
    ...referenceMedia.map((item) => item.url),
  ];
  return {
    brief,
    aspectRatio: normalizeAspectRatio(body.aspectRatio),
    duration: normalizeDuration(body.duration),
    style: typeof body.style === "string" && body.style.trim() ? body.style.trim() : "cinematic",
    goal: typeof body.goal === "string" ? body.goal.trim() : null,
    destinationUrl: typeof body.destinationUrl === "string" ? body.destinationUrl.trim() : null,
    platforms: normalizeStringArray(body.platforms),
    referenceMediaUrls: [...new Set(referenceMediaUrls)].slice(0, 12),
    referenceMedia,
    characterBrief: typeof body.characterBrief === "string" ? body.characterBrief.trim() : null,
  };
}

async function generateStoryAdScript(
  input: StoryAdMovieInput,
  brand: BrandSnapshot,
  language: string,
): Promise<StoryAdMovieScript> {
  const sceneCount = input.duration <= 10 ? 4 : input.duration <= 20 ? 5 : input.duration <= 30 ? 6 : 8;
  const wordsPerScene = input.duration <= 10 ? 8 : input.duration <= 20 ? 10 : 12;
  const styleHint = STYLE_HINTS[input.style] || STYLE_HINTS.cinematic;
  const destination = input.destinationUrl || brand.website || "";
  const platforms = input.platforms?.length ? input.platforms.join(", ") : "social feed";
  const referenceItems: StoryAdMovieReferenceMedia[] = input.referenceMedia?.length
    ? input.referenceMedia
    : (input.referenceMediaUrls || []).map((url) => ({ url }));
  const references = referenceItems.length
    ? referenceItems.map((item, index) => [
        `${index + 1}. ${item.url}`,
        item.scene ? `Scene: ${item.scene}` : null,
        item.note ? `Use for: ${item.note}` : null,
      ].filter(Boolean).join(" | ")).join("\n")
    : "No reference media supplied";

  const prompt = `Create a direct xAI video-generation plan for a story-driven advertising movie.

BRAND
- Name: ${brand.name}
${brand.tagline ? `- Tagline: ${brand.tagline}` : ""}
${brand.description ? `- Description: ${brand.description}` : ""}
${brand.industry ? `- Industry: ${brand.industry}` : ""}
${brand.niche ? `- Niche: ${brand.niche}` : ""}
${brand.targetAudience ? `- Audience: ${brand.targetAudience}` : ""}
${brand.voiceTone ? `- Voice: ${brand.voiceTone}` : ""}
${brand.personality.length ? `- Personality: ${brand.personality.join(", ")}` : ""}
${brand.products.length ? `- Products or services: ${brand.products.join(", ")}` : ""}
${brand.uniqueValue ? `- Unique value: ${brand.uniqueValue}` : ""}

USER BRIEF
${input.brief}

GOAL
${input.goal || "Create desire, trust, and a clear reason to act."}

SOCIAL DESTINATIONS
${platforms}

CTA LINK OR WEBSITE
${destination || "No URL provided"}

CHARACTER OR TALENT
${input.characterBrief || "AI should choose natural people, product moments, or scene talent that fit the brand."}

REFERENCE MEDIA
${references}

FORMAT
- ${input.duration} seconds
- ${sceneCount} scenes
- Aspect ratio ${input.aspectRatio}
- Visual style: ${styleHint}

REQUIREMENTS
1. This is not a cartoon and not a patched slideshow. It is a direct AI-generated advertising video with real motion.
2. Tell a mini story: hook, customer pain, transformation, proof, offer, call to action.
3. Every scene must have concise narration or native audio direction, around ${wordsPerScene} words.
4. videoPrompt must be a single polished prompt ready for xAI Grok video generation.
5. imagePrompt is only a visual beat description for timeline preview; do not ask for separate generated images.
6. Keep on-screen text minimal. No fake logos, watermarks, distorted hands, or unreadable UI.
7. campaignCaption should be ready to post on the selected social platforms.
8. hashtags should be 3 to 6 clean business hashtags.

Return strict JSON only:
{
  "title": "Short ad title",
  "campaignCaption": "Social post caption",
  "ctaText": "Short CTA",
  "hashtags": ["#Example"],
  "videoPrompt": "One direct video-generation prompt for xAI",
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "Voiceover text",
      "imagePrompt": "AI image prompt",
      "caption": "Optional"
    }
  ]
}`;

  // Per feedback-ai-respects-user-language: every text field the
  // pipeline produces (title, captions, narration, hashtags) must land
  // in the user's language. voiceover TTS will pick this up downstream
  // when we pass the same `language` tag to the voice client.
  const languageLabel = getLanguageLabel(language);
  const systemPrompt = `${languageDirective(language)}\n\nYou are a senior creative director for direct-response video ads. Return valid JSON only. Build premium, story-driven commercial still movies. All narration / captions / titles / hashtags MUST be in ${languageLabel}. The videoPrompt + imagePrompt may stay in English for the image/video models, but any TEXT inside those prompts (signs, on-screen copy) should specify ${languageLabel}.`;

  const result = await ai.generateJSON<StoryAdMovieScript>(prompt, {
    maxTokens: 2600,
    temperature: 0.78,
    systemPrompt,
  });

  if (!result?.scenes?.length) {
    throw new Error("AI did not return a usable story ad movie plan");
  }

  const scenes = result.scenes.slice(0, sceneCount).map((scene, index) => ({
    sceneNumber: index + 1,
    narration: String(scene.narration || "").trim(),
    imagePrompt: [
      String(scene.imagePrompt || "").trim(),
      `Style: ${styleHint}.`,
      `Frame: ${input.aspectRatio} advertising still.`,
      "No text, no lettering, no subtitles, no watermark, no fake logo.",
    ].join(" "),
    caption: String(scene.caption || "").trim().slice(0, 42),
  })).filter((scene) => scene.narration && scene.imagePrompt);

  if (!scenes.length) {
    throw new Error("AI returned empty story scenes");
  }

  return {
    title: String(result.title || `${brand.name} Story Ad`).trim().slice(0, 90),
    campaignCaption: String(result.campaignCaption || input.brief).trim().slice(0, 700),
    ctaText: String(result.ctaText || "Learn More").trim().slice(0, 40),
    videoPrompt: String(result.videoPrompt || "").trim(),
    hashtags: (Array.isArray(result.hashtags) ? result.hashtags : [])
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 6),
    scenes,
  };
}

async function ensureStoryAdMovieFolder(userId: string): Promise<string> {
  const name = "Story Ad Movies";
  const existing = await prisma.mediaFolder.findFirst({
    where: { userId, name, parentId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const folder = await prisma.mediaFolder.create({ data: { userId, name } });
  return folder.id;
}

async function saveStoryAdMovieToLibrary(options: {
  userId: string;
  title: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  size: number;
}) {
  const folderId = await ensureStoryAdMovieFolder(options.userId);
  await prisma.mediaFile.create({
    data: {
      userId: options.userId,
      filename: `${options.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "story-ad-movie"}.mp4`,
      originalName: `${options.title} - Story Ad Movie`,
      url: options.videoUrl,
      type: "video",
      mimeType: "video/mp4",
      size: options.size,
      folderId,
      tags: JSON.stringify(["story-ad-movie", "ad", "ai-generated"]),
      metadata: JSON.stringify({
        title: options.title,
        source: "story-ad-movie",
        thumbnail: options.thumbnailUrl || null,
      }),
    },
  });
}

async function refundFailedJob(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Story ad movie generation failed";
  const job = await prisma.cartoonVideo.findUnique({
    where: { id: jobId },
    select: { userId: true, creditsCost: true, metadata: true },
  });
  if (!job) return;

  let chargedCredits = job.creditsCost;
  try {
    const meta = JSON.parse(job.metadata || "{}");
    chargedCredits = Number(meta.chargedCredits || chargedCredits);
  } catch {}

  const user = await prisma.user.findUnique({
    where: { id: job.userId },
    select: { aiCredits: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.cartoonVideo.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        progress: 0,
        currentStep: null,
        errorMessage: message,
      },
    });

    if (chargedCredits > 0) {
      await tx.user.update({
        where: { id: job.userId },
        data: { aiCredits: { increment: chargedCredits } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: job.userId,
          type: TRANSACTION_TYPES.REFUND,
          amount: chargedCredits,
          balanceAfter: (user?.aiCredits || 0) + chargedCredits,
          referenceType: "story_ad_movie",
          referenceId: jobId,
          description: "Refund for failed story ad movie",
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: job.userId,
        type: "AI_VIDEO_FAILED",
        title: "Story ad movie failed",
        message: chargedCredits > 0
          ? `We could not finish your story ad movie. Your ${chargedCredits} credits were refunded.`
          : "We could not finish your story ad movie.",
        actionUrl: "/story-ad-movie",
      },
    });
  });
}

function toCartoonCompatibleScript(script: StoryAdMovieScript) {
  return {
    title: script.title,
    campaignCaption: script.campaignCaption,
    ctaText: script.ctaText,
    hashtags: script.hashtags,
    videoPrompt: script.videoPrompt,
    characters: [],
    scenes: script.scenes.map((scene) => ({
      sceneNumber: scene.sceneNumber,
      dialogue: [],
      narration: scene.narration,
      visualDescription: scene.imagePrompt,
      imagePrompt: scene.imagePrompt,
      caption: scene.caption,
      durationSeconds: 5,
      charactersInScene: [],
    })),
    totalDuration: script.scenes.length * 5,
  };
}

function normalizeVideoAspect(aspectRatio: StoryAdMovieAspectRatio): "16:9" | "9:16" | "1:1" {
  return aspectRatio === "9:16" ? "9:16" : aspectRatio === "1:1" ? "1:1" : "16:9";
}

function isImageReference(url: string): boolean {
  const clean = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|webp|gif)$/.test(clean);
}

async function resolveXaiReferenceImage(
  referenceMediaUrls: string[] = [],
  brand?: BrandSnapshot,
): Promise<string | undefined> {
  const rawImage = referenceMediaUrls.find(isImageReference) || brand?.logo || brand?.iconLogo;
  if (!rawImage) return undefined;
  if (rawImage.startsWith("data:")) return undefined;
  if (rawImage.startsWith("/") && !rawImage.startsWith("/uploads/")) return undefined;
  if (/^https?:\/\//i.test(rawImage) && !/amazonaws\.com|flowsmartly/i.test(rawImage)) {
    return rawImage;
  }
  try {
    return await getPresignedUrl(rawImage, 3600);
  } catch {
    return rawImage;
  }
}

function compactText(value: string | null | undefined, maxLength: number): string {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 1).trimEnd()}...`;
}

function getChapterScenes(
  scenes: StoryAdMovieScene[],
  chapterIndex: number,
  totalChapters: number,
): StoryAdMovieScene[] {
  if (totalChapters <= 1 || scenes.length <= 1) return scenes;
  const start = Math.floor(((chapterIndex - 1) * scenes.length) / totalChapters);
  const end = Math.max(start + 1, Math.floor((chapterIndex * scenes.length) / totalChapters));
  return scenes.slice(start, Math.min(end, scenes.length));
}

function buildDirectXaiVideoPrompt(
  script: StoryAdMovieScript,
  input: StoryAdMovieInput,
  brand: BrandSnapshot,
  chapter?: { index: number; total: number },
): string {
  const platforms = input.platforms?.length ? input.platforms.join(", ") : "social feed";
  const references = input.referenceMediaUrls?.length
    ? `Reference media supplied (${input.referenceMediaUrls.length}). Preserve real product, people, place, colors, and mood when relevant.`
    : brand.logo || brand.iconLogo
      ? "Use the brand identity/logo as the visual anchor."
      : "No reference media supplied; invent clean brand-safe commercial visuals.";
  const referenceSceneMap = input.referenceMedia?.length
    ? input.referenceMedia.slice(0, 5).map((item, index) => [
        `Ref ${index + 1}: ${item.type || "media"}`,
        item.scene ? `Scene: ${compactText(item.scene, 90)}` : null,
        item.note ? `Use: ${compactText(item.note, 140)}` : null,
      ].filter(Boolean).join(" | ")).join("\n")
    : "";
  const activeScenes = chapter ? getChapterScenes(script.scenes, chapter.index, chapter.total) : script.scenes;
  const sceneArc = activeScenes
    .map((scene) => `${scene.sceneNumber}. ${scene.narration} ${scene.caption ? `(${scene.caption})` : ""}`)
    .join(" ");
  const chapterLine = chapter
    ? `This is chapter ${chapter.index} of ${chapter.total} in a ${input.duration}-second campaign. Render exactly ${STORY_AD_SECONDS_PER_CHAPTER} seconds. ${chapter.index === 1 ? "Open with a fast hook." : ""} ${chapter.index === chapter.total ? "End with the strongest call to action." : "End naturally so the next chapter can continue."}`.trim()
    : "";
  const brandLine = [
    brand.name,
    brand.tagline,
    brand.industry,
    brand.targetAudience ? `Audience: ${brand.targetAudience}` : null,
    brand.voiceTone ? `Voice: ${brand.voiceTone}` : null,
    brand.uniqueValue,
  ].filter(Boolean).join(" | ");

  return [
    compactText(script.videoPrompt || input.brief, 650),
    "",
    "Generate a complete moving advertisement video, not a slideshow and not separate still frames.",
    chapterLine,
    `Duration: ${chapter ? STORY_AD_SECONDS_PER_CHAPTER : input.duration} seconds. Aspect ratio: ${input.aspectRatio}. Style: ${STYLE_HINTS[input.style] || STYLE_HINTS.cinematic}.`,
    `Target platforms: ${platforms}.`,
    `Brand identity: ${compactText(brandLine, 500)}.`,
    brand.description ? `Brand description: ${compactText(brand.description, 260)}.` : "",
    brand.personality.length ? `Brand personality: ${brand.personality.slice(0, 5).join(", ")}.` : "",
    brand.products.length ? `Products/services: ${brand.products.slice(0, 6).join(", ")}.` : "",
    input.goal ? `Campaign goal: ${compactText(input.goal, 180)}.` : "",
    input.characterBrief ? `Main character or talent: ${compactText(input.characterBrief, 240)}.` : "",
    references,
    referenceSceneMap ? `Scene-specific reference map:\n${referenceSceneMap}` : "",
    `Story beat: ${compactText(sceneArc, chapter ? 650 : 1000)}`,
    `Call to action: ${script.ctaText || "Learn more"}.`,
    "Use natural camera movement, polished lighting, realistic motion, and native commercial audio or voiceover if supported.",
    "Avoid watermarks, fake competitor logos, unreadable text, distorted hands, broken faces, and cluttered UI screens.",
  ].filter(Boolean).join("\n");
}

function runFFmpeg(args: string[], timeoutMs = 600000): Promise<void> {
  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath) {
    throw new Error("Video assembly is not available on this server.");
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Video assembly timed out."));
    }, timeoutMs);

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Video assembly failed (${code}): ${stderr.slice(-800)}`));
    });
  });
}

async function concatenateXaiChapters(chapters: Buffer[]): Promise<Buffer> {
  if (chapters.length === 1) return chapters[0];

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "story-ad-movie-"));
  const outputPath = path.join(tempDir, "final.mp4");
  const listPath = path.join(tempDir, "chapters.txt");

  try {
    const chapterPaths: string[] = [];
    for (let index = 0; index < chapters.length; index++) {
      const chapterPath = path.join(tempDir, `chapter-${index + 1}.mp4`);
      await writeFile(chapterPath, chapters[index]);
      chapterPaths.push(chapterPath);
    }

    const list = chapterPaths
      .map((chapterPath) => `file '${chapterPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`)
      .join("\n");
    await writeFile(listPath, list);

    try {
      await runFFmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", outputPath,
      ]);
    } catch {
      await runFFmpeg([
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        "-y", outputPath,
      ], 900000);
    }

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function processStoryAdMovie(input: StoryAdMovieInput): Promise<void> {
  try {
    await updateJobStatus(input.jobId, "PROCESSING", 8, "Reading your brand and offer...");
    const [brand, language] = await Promise.all([
      getBrandSnapshot(input.userId),
      getUserPreferredLanguage(input.userId),
    ]);

    await updateJobStatus(input.jobId, "PROCESSING", 18, "Writing the ad story...");
    const script = await generateStoryAdScript(input, brand, language);
    const compatibleScript = toCartoonCompatibleScript(script);

    const existingMeta = await prisma.cartoonVideo.findUnique({
      where: { id: input.jobId },
      select: { metadata: true },
    });
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(existingMeta?.metadata || "{}");
    } catch {}

    await updateJobStatus(input.jobId, "PROCESSING", 28, "Story ready. Creating scenes...", {
      script: JSON.stringify(compatibleScript),
      metadata: JSON.stringify({
        ...metadata,
        product: "story_ad_movie",
        aspectRatio: input.aspectRatio,
        duration: input.duration,
        style: input.style,
        goal: input.goal || null,
        destinationUrl: input.destinationUrl || brand.website || null,
        platforms: input.platforms || [],
        referenceMediaUrls: input.referenceMediaUrls || [],
        referenceMedia: input.referenceMedia || [],
        characterBrief: input.characterBrief || null,
        provider: "xai",
        model: "grok-imagine-video",
        brand,
      }),
    });

    if (!grokVideoClient.isAvailable()) {
      throw new Error("xAI video generation is not configured.");
    }

    const xaiReferenceImage = await resolveXaiReferenceImage(input.referenceMediaUrls, brand);
    const totalChapters = Math.ceil(input.duration / STORY_AD_SECONDS_PER_CHAPTER);
    const chapterBuffers: Buffer[] = [];
    let renderedDuration = 0;

    for (let chapter = 1; chapter <= totalChapters; chapter++) {
      const chapterPrompt = buildDirectXaiVideoPrompt(
        script,
        input,
        brand,
        totalChapters > 1 ? { index: chapter, total: totalChapters } : undefined,
      );
      const progress = 45 + Math.round(((chapter - 1) / totalChapters) * 38);
      await updateJobStatus(
        input.jobId,
        "COMPOSITING",
        progress,
        totalChapters > 1
          ? `Rendering xAI video chapter ${chapter} of ${totalChapters}...`
          : "Sending your story to xAI video...",
      );

      const result = await grokVideoClient.generateVideo(chapterPrompt, {
        duration: totalChapters > 1 ? STORY_AD_SECONDS_PER_CHAPTER : input.duration,
        aspectRatio: normalizeVideoAspect(input.aspectRatio),
        resolution: "720p",
        imageUrl: chapter === 1 ? xaiReferenceImage : undefined,
        timeoutMs: 900000,
        onStatus: (message) => {
          updateJobStatus(
            input.jobId,
            "COMPOSITING",
            progress + 5,
            totalChapters > 1 ? `Chapter ${chapter}: ${message}` : message,
          ).catch(console.error);
        },
      });
      chapterBuffers.push(result.videoBuffer);
      renderedDuration += result.duration || STORY_AD_SECONDS_PER_CHAPTER;
    }

    await updateJobStatus(input.jobId, "COMPOSITING", 88, "Preparing the final movie...");
    const finalVideoBuffer = await concatenateXaiChapters(chapterBuffers);

    await updateJobStatus(input.jobId, "PROCESSING", 92, "Publishing your ad movie...");
    const videoUrl = await uploadToS3(
      `story-ad-movies/${input.userId}/${input.jobId}/${nanoid(8)}.mp4`,
      finalVideoBuffer,
      "video/mp4",
    );
    const thumbnailUrl = input.referenceMediaUrls?.find(isImageReference) || brand.logo || brand.iconLogo || null;

    await prisma.cartoonVideo.update({
      where: { id: input.jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        currentStep: "Story ad movie ready",
        videoUrl,
        thumbnailUrl,
        videoDuration: renderedDuration || input.duration,
        completedAt: new Date(),
      },
    });

    await saveStoryAdMovieToLibrary({
      userId: input.userId,
      title: script.title,
      videoUrl,
      thumbnailUrl,
      size: finalVideoBuffer.length,
    });

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: "AI_VIDEO_COMPLETE",
        title: "Story ad movie ready",
        message: `${script.title} is ready to post or promote.`,
        actionUrl: `/story-ad-movie?id=${input.jobId}`,
      },
    });
  } catch (error) {
    console.error("[StoryAdMovie] processing error:", error);
    await refundFailedJob(input.jobId, error);
  }
}
