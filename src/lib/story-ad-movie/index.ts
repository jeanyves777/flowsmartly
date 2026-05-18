import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { TRANSACTION_TYPES } from "@/lib/credits";
import { generateVoice } from "@/lib/voice/voice-engine";
import {
  compositeSlideshowVideo,
  generateSlideshowImages,
  type SlideshowScene,
} from "@/lib/video-studio";
import { getPresignedUrl, uploadToS3 } from "@/lib/utils/s3-client";
import { nanoid } from "nanoid";
import fs from "fs";

export type StoryAdMovieAspectRatio = "9:16" | "1:1" | "16:9";
export type StoryAdMovieDuration = 15 | 30 | 45;

export interface StoryAdMovieInput {
  jobId: string;
  userId: string;
  brief: string;
  aspectRatio: StoryAdMovieAspectRatio;
  duration: StoryAdMovieDuration;
  style: string;
  goal?: string | null;
  destinationUrl?: string | null;
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
  scenes: SlideshowScene[];
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
  if (numeric <= 15) return 15;
  if (numeric <= 30) return 30;
  return 45;
}

export function normalizeStoryAdMovieInput(body: Record<string, unknown>) {
  const brief = String(body.brief || body.storyPrompt || "").trim();
  return {
    brief,
    aspectRatio: normalizeAspectRatio(body.aspectRatio),
    duration: normalizeDuration(body.duration),
    style: typeof body.style === "string" && body.style.trim() ? body.style.trim() : "cinematic",
    goal: typeof body.goal === "string" ? body.goal.trim() : null,
    destinationUrl: typeof body.destinationUrl === "string" ? body.destinationUrl.trim() : null,
  };
}

async function generateStoryAdScript(input: StoryAdMovieInput, brand: BrandSnapshot): Promise<StoryAdMovieScript> {
  const sceneCount = input.duration <= 15 ? 4 : input.duration <= 30 ? 5 : 7;
  const wordsPerScene = input.duration <= 15 ? 9 : input.duration <= 30 ? 12 : 14;
  const styleHint = STYLE_HINTS[input.style] || STYLE_HINTS.cinematic;
  const destination = input.destinationUrl || brand.website || "";

  const prompt = `Create a story-driven advertising still movie for this business.

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

DESTINATION
${destination || "No URL provided"}

FORMAT
- ${input.duration} seconds
- ${sceneCount} scenes
- Aspect ratio ${input.aspectRatio}
- Visual style: ${styleHint}

REQUIREMENTS
1. This is not a cartoon. It is a premium advertising still movie built from cinematic scenes.
2. Tell a mini story: hook, customer pain, transformation, proof, offer, call to action.
3. Every scene must have concise voiceover narration, around ${wordsPerScene} words.
4. imagePrompt must describe a realistic or polished commercial still with NO text, NO fake logos, NO readable letters, NO UI, NO captions in the image.
5. caption must be 0 to 4 words. Keep at least two captions empty for a clean ad.
6. campaignCaption should be ready to post on a social feed.
7. hashtags should be 3 to 6 clean business hashtags.

Return strict JSON only:
{
  "title": "Short ad title",
  "campaignCaption": "Social post caption",
  "ctaText": "Short CTA",
  "hashtags": ["#Example"],
  "scenes": [
    {
      "sceneNumber": 1,
      "narration": "Voiceover text",
      "imagePrompt": "AI image prompt",
      "caption": "Optional"
    }
  ]
}`;

  const result = await ai.generateJSON<StoryAdMovieScript>(prompt, {
    maxTokens: 2600,
    temperature: 0.78,
    systemPrompt:
      "You are a senior creative director for direct-response video ads. Return valid JSON only. Build premium, story-driven commercial still movies.",
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
    hashtags: (Array.isArray(result.hashtags) ? result.hashtags : [])
      .map((tag) => String(tag).trim())
      .filter(Boolean)
      .slice(0, 6),
    scenes,
  };
}

async function generateVoiceoverAudio(script: StoryAdMovieScript, brand: BrandSnapshot): Promise<Buffer> {
  const narration = script.scenes.map((scene) => scene.narration).join(" ");
  const voiceTone = (brand.voiceTone || "").toLowerCase();
  const dramatic = voiceTone.includes("bold") || voiceTone.includes("luxury") || voiceTone.includes("premium");

  const result = await generateVoice({
    text: narration,
    gender: dramatic ? "male" : "female",
    accent: "american",
    style: dramatic ? "dramatic" : "professional",
    speed: 0.98,
    overrideVoice: dramatic ? "onyx" : "nova",
  });

  return result.audioBuffer;
}

async function resolveBrandLogo(brand: BrandSnapshot): Promise<string | null> {
  const logo = brand.logo || brand.iconLogo;
  if (!logo) return null;
  if (logo.startsWith("data:") || logo.startsWith("http") || logo.startsWith("/")) {
    try {
      return logo.startsWith("http") ? await getPresignedUrl(logo) : logo;
    } catch {
      return logo;
    }
  }
  try {
    return await getPresignedUrl(logo);
  } catch {
    return null;
  }
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

export async function processStoryAdMovie(input: StoryAdMovieInput): Promise<void> {
  try {
    await updateJobStatus(input.jobId, "PROCESSING", 8, "Reading your brand and offer...");
    const brand = await getBrandSnapshot(input.userId);
    const brandLogo = await resolveBrandLogo(brand);

    await updateJobStatus(input.jobId, "PROCESSING", 18, "Writing the ad story...");
    const script = await generateStoryAdScript(input, brand);
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
        brand,
      }),
    });

    const images = await generateSlideshowImages(script.scenes, input.aspectRatio, (current, total) => {
      updateJobStatus(
        input.jobId,
        "PROCESSING",
        30 + Math.round((current / total) * 30),
        `Creating scene ${current}/${total}...`,
      ).catch(console.error);
    });

    const sceneImages = await Promise.all(images.map(async (image, index) => {
      const buffer = fs.readFileSync(image.localPath);
      const imageUrl = await uploadToS3(
        `story-ad-movies/${input.userId}/${input.jobId}/scene-${index + 1}.png`,
        buffer,
        "image/png",
      );
      return { sceneNumber: image.sceneNumber, imageUrl };
    }));

    const thumbnailUrl = sceneImages[0]?.imageUrl || null;
    await updateJobStatus(input.jobId, "PROCESSING", 64, "Recording voiceover...", {
      sceneImages: JSON.stringify(sceneImages),
      thumbnailUrl,
    });

    const audioBuffer = await generateVoiceoverAudio(script, brand);

    await updateJobStatus(input.jobId, "COMPOSITING", 78, "Turning scenes into a movie...");
    const videoBuffer = await compositeSlideshowVideo({
      scenes: script.scenes,
      images,
      audioBuffer,
      resolution: "720p",
      aspectRatio: input.aspectRatio,
      brandLogo,
    });

    await updateJobStatus(input.jobId, "PROCESSING", 92, "Publishing your ad movie...");
    const videoUrl = await uploadToS3(
      `story-ad-movies/${input.userId}/${input.jobId}/${nanoid(8)}.mp4`,
      videoBuffer,
      "video/mp4",
    );

    await prisma.cartoonVideo.update({
      where: { id: input.jobId },
      data: {
        status: "COMPLETED",
        progress: 100,
        currentStep: "Story ad movie ready",
        videoUrl,
        thumbnailUrl,
        videoDuration: input.duration,
        completedAt: new Date(),
      },
    });

    await saveStoryAdMovieToLibrary({
      userId: input.userId,
      title: script.title,
      videoUrl,
      thumbnailUrl,
      size: videoBuffer.length,
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
