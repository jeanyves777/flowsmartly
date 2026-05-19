import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { prisma } from "@/lib/db/client";
import { geminiText as ai } from "@/lib/ai/gemini-text-client";

const prepareFromMediaSchema = z.object({
  mediaUrl: z.string().min(8).max(14_000_000),
  mediaType: z.enum(["image", "video"]).default("image"),
  platforms: z.array(z.string()).default(["facebook"]),
  prompt: z.string().max(1200).optional(),
  brandBrief: z.string().max(3000).optional(),
});

type PreparedPost = {
  mediaDescription: string;
  caption: string;
  hashtags: string[];
  seoKeywords: string[];
};

const AI_PLATFORMS = new Set(["instagram", "twitter", "linkedin", "facebook", "youtube"]);
const VISION_MAX_BYTES = 4_800_000;
const VISION_MODEL = process.env.FLOWCREATIVE_VISION_MODEL || "claude-haiku-4-5";

const primaryAnthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;
const backupAnthropic = process.env.ANTHROPIC_BACKUP_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_BACKUP_API_KEY })
  : null;

function normalizePlatforms(platforms: string[]) {
  const normalized = platforms
    .map((platform) => platform.toLowerCase().trim())
    .filter((platform) => AI_PLATFORMS.has(platform));
  return normalized.length > 0 ? Array.from(new Set(normalized)) : ["facebook"];
}

function safeJsonArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function safeJsonObject(value: string | null | undefined): Record<string, string> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(
          Object.entries(parsed).filter(([, item]) => typeof item === "string" && item.trim().length > 0)
        ) as Record<string, string>
      : {};
  } catch {
    return {};
  }
}

function buildBrandBriefFromKit(brandKit: Awaited<ReturnType<typeof loadBrandKit>>) {
  if (!brandKit) return "";
  const colors = safeJsonObject(brandKit.colors);
  const handles = safeJsonObject(brandKit.handles);
  return [
    `Brand: ${brandKit.name}`,
    brandKit.tagline ? `Tagline: ${brandKit.tagline}` : null,
    brandKit.description ? `Description: ${brandKit.description}` : null,
    brandKit.industry ? `Industry: ${brandKit.industry}` : null,
    brandKit.niche ? `Niche: ${brandKit.niche}` : null,
    brandKit.targetAudience ? `Audience: ${brandKit.targetAudience}` : null,
    brandKit.uniqueValue ? `Value: ${brandKit.uniqueValue}` : null,
    brandKit.voiceTone ? `Voice: ${brandKit.voiceTone}` : null,
    safeJsonArray(brandKit.products).length ? `Products/services: ${safeJsonArray(brandKit.products).join(", ")}` : null,
    safeJsonArray(brandKit.keywords).length ? `Keywords: ${safeJsonArray(brandKit.keywords).join(", ")}` : null,
    safeJsonArray(brandKit.hashtags).length ? `Preferred hashtags: ${safeJsonArray(brandKit.hashtags).join(", ")}` : null,
    Object.keys(colors).length ? `Brand colors: ${Object.entries(colors).map(([key, value]) => `${key} ${value}`).join(", ")}` : null,
    Object.keys(handles).length ? `Social handles: ${Object.entries(handles).map(([key, value]) => `${key} ${value}`).join(", ")}` : null,
    brandKit.website ? `Website: ${brandKit.website}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadBrandKit(userId: string) {
  return prisma.brandKit.findFirst({
    where: { userId, isDefault: true },
  }).then((kit) => kit || prisma.brandKit.findFirst({ where: { userId } }));
}

function parseJsonPayload(raw: string): Record<string, unknown> | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  const candidates = [
    cleaned,
    objectStart >= 0 && objectEnd > objectStart ? cleaned.slice(objectStart, objectEnd + 1) : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      // Continue with the next likely slice.
    }
  }
  return null;
}

function normalizeHashtags(value: unknown, fallback: string, limit = 12): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\s,]+/)
      : fallback.match(/#[\p{L}\p{N}_]+/gu) || [];
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of source) {
    const cleaned = String(item)
      .trim()
      .replace(/^#+/, "")
      .replace(/[^\p{L}\p{N}_]/gu, "");
    if (!cleaned) continue;
    const tag = `#${cleaned}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= limit) break;
  }
  return tags;
}

function normalizeKeywords(value: unknown, fallback: string, limit = 10): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;\n]+/)
      : [];
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const item of source) {
    const cleaned = String(item)
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ")
      .slice(0, 70);
    if (cleaned.length < 3) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(cleaned);
    if (keywords.length >= limit) break;
  }

  if (keywords.length) return keywords;
  return fallback
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .split(/[.!?\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12)
    .slice(0, limit);
}

function extractBrandName(brandBrief: string) {
  const match = brandBrief.match(/^Brand:\s*(.+)$/im);
  return match?.[1]?.trim().slice(0, 80) || "the brand";
}

function extractHashtagTerms(text: string, limit = 8) {
  const seen = new Set<string>();
  const tags: string[] = [];
  const words = text
    .replace(/https?:\/\/\S+/gi, " ")
    .split(/[^a-zA-Z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !/^(with|from|that|this|your|have|will|into|video|image|media)$/i.test(word));

  for (const word of words) {
    const tag = `#${word.replace(/[^a-zA-Z0-9]/g, "")}`;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= limit) break;
  }

  return tags;
}

function buildFallbackPreparedPost(params: {
  mediaType: "image" | "video";
  brandBrief: string;
  userPrompt?: string;
  platforms: string[];
}): PreparedPost {
  const brandName = extractBrandName(params.brandBrief);
  const promptText = (params.userPrompt || "").trim();
  const quotedTopic = promptText.match(/["']([^"']{4,90})["']/)?.[1]?.trim();
  const cleanPrompt = (quotedTopic || promptText)
    .replace(/\s+/g, " ")
    .replace(/^user prompt:\s*/i, "")
    .replace(/\b(?:destination|audience|angle|cta|platforms?)\s*:[^.;\n]+[.;]?/gi, "")
    .replace(/\b(?:schedule|create|write|generate|draft|publish|repurpose|mirror(?:ed)?)\b/gi, "")
    .replace(/\b(?:weekly|daily|monthly|instagram|facebook|linkedin|twitter|social media|posts?|captions?|content calendar)\b/gi, "")
    .replace(/^[\s:;,.|-]+|[\s:;,.|-]+$/g, "")
    .slice(0, 260);
  const mediaLabel = params.mediaType === "video" ? "video" : "visual";
  const topic = cleanPrompt || `a new ${mediaLabel} from ${brandName}`;
  const hashtags = extractHashtagTerms(`${brandName} ${topic}`).slice(0, 8);
  const finalHashtags = hashtags.length ? hashtags : ["#Marketing", "#SmallBusiness", "#BrandStory"];

  const caption = [
    `${brandName} has a fresh ${mediaLabel} to share.`,
    `Here is a quick look at ${topic}.`,
    "Take a look, save it for later, and reach out when you are ready to learn more.",
    finalHashtags.join(" "),
  ].join("\n\n");

  return {
    mediaDescription: `FlowCreative ${mediaLabel} prepared from the generated media and brand context.`,
    caption: caption.slice(0, 2000),
    hashtags: finalHashtags,
    seoKeywords: normalizeKeywords([], `${brandName}. ${topic}`, 10),
  };
}

function normalizePreparedPost(raw: unknown): PreparedPost | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const caption = typeof item.caption === "string" ? item.caption.trim() : "";
  if (!caption) return null;
  if (/\b(?:destination|audience|angle|cta|saved prompt|platforms?)\s*:/i.test(caption)) return null;
  if (/\b(?:schedule|create|write|generate|draft|publish|repurpose|mirror(?:ed)?)\b.{0,90}\b(?:posts?|captions?|content calendar|instagram|facebook|linkedin|twitter|social)\b/i.test(caption)) return null;
  const hashtags = normalizeHashtags(item.hashtags, caption);
  const seoKeywords = normalizeKeywords(item.seoKeywords || item.keywords, caption);
  const missingTags = hashtags.filter((tag) => !caption.toLowerCase().includes(tag.toLowerCase()));
  const finalCaption = missingTags.length
    ? `${caption.replace(/\s+$/g, "")}\n\n${missingTags.join(" ")}`
    : caption;

  return {
    mediaDescription:
      typeof item.mediaDescription === "string" && item.mediaDescription.trim()
        ? item.mediaDescription.trim().slice(0, 700)
        : "FlowCreative media prepared for a social post.",
    caption: finalCaption.slice(0, 2000),
    hashtags,
    seoKeywords,
  };
}

function mediaTypeFromDataUri(value: string): "image/jpeg" | "image/png" | "image/webp" {
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,/i);
  const mime = match?.[1]?.toLowerCase();
  return mime === "image/jpeg" || mime === "image/webp" ? mime : "image/png";
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function loadImageBuffer(mediaUrl: string, request: NextRequest): Promise<{ buffer: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" }> {
  if (mediaUrl.startsWith("data:image/")) {
    return {
      buffer: Buffer.from(mediaUrl.replace(/^data:image\/[^;]+;base64,/, ""), "base64"),
      mediaType: mediaTypeFromDataUri(mediaUrl),
    };
  }

  const url = isHttpUrl(mediaUrl) ? mediaUrl : new URL(mediaUrl, request.url).toString();
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load the generated media for analysis.");
  }
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  const mediaType =
    contentType.includes("webp") ? "image/webp" :
    contentType.includes("jpeg") || contentType.includes("jpg") ? "image/jpeg" :
    "image/png";
  return { buffer, mediaType };
}

async function shrinkForVision(buffer: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp") {
  if (buffer.length <= VISION_MAX_BYTES) {
    return { base64: buffer.toString("base64"), mediaType };
  }

  const meta = await sharp(buffer).metadata();
  const longest = Math.max(meta.width || 0, meta.height || 0);
  const target = Math.min(1800, longest || 1800);
  const resized = await sharp(buffer)
    .resize(longest > target ? target : undefined, longest > target ? target : undefined, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  return { base64: resized.toString("base64"), mediaType: "image/jpeg" as const };
}

function buildPrompt(params: {
  brandBrief: string;
  platforms: string[];
  mediaType: "image" | "video";
  userPrompt?: string;
}) {
  const platformInstruction = params.platforms.includes("twitter")
    ? "Because X/Twitter is selected, keep the main caption under 260 characters while still including 2-3 strong hashtags."
    : "Write 90-170 words with real paragraph breaks, a strong opening line, clear value, and a natural CTA.";

  return `Prepare a complete social media post from FlowCreative media.

Brand identity:
${params.brandBrief || "Use a professional brand voice."}

Selected platforms: ${params.platforms.join(", ")}
Media type: ${params.mediaType}
User's creation prompt/context: ${params.userPrompt || "No extra prompt provided."}

Analyze the attached media when available and make the post match what is actually visible. If the media has text, product names, proof stats, colors, faces, or offer details, use them accurately.

Rules:
- Return only valid JSON.
- The caption must be ready to paste and publish.
- Use tasteful emojis to separate hook, value, and CTA.
- Use real line breaks. Do not produce one compact wall of text.
- Do not expose labels such as Hook, Body, CTA, Hashtags, or SEO in the caption.
- Include relevant hashtags at the end of the caption.
- Include SEO/search keywords as phrases in seoKeywords, and naturally use several of them in the caption.
- No placeholders. No made-up website, phone, discount, address, or guarantee unless visible in the media or brand identity.
- ${platformInstruction}

JSON shape:
{
  "mediaDescription": "short factual description of the visible media",
  "caption": "ready-to-post caption with paragraph breaks, emojis, CTA, and hashtags",
  "hashtags": ["#Example", "#ExampleTwo"],
  "seoKeywords": ["search phrase one", "search phrase two"]
}`;
}

async function generatePreparedPost(params: {
  request: NextRequest;
  mediaUrl: string;
  mediaType: "image" | "video";
  brandBrief: string;
  platforms: string[];
  userPrompt?: string;
}) {
  const prompt = buildPrompt({
    brandBrief: params.brandBrief,
    platforms: params.platforms,
    mediaType: params.mediaType,
    userPrompt: params.userPrompt,
  });

  if (params.mediaType === "image" && (primaryAnthropic || backupAnthropic)) {
    try {
      const loaded = await loadImageBuffer(params.mediaUrl, params.request);
      const image = await shrinkForVision(loaded.buffer, loaded.mediaType);
      const clients = [primaryAnthropic, backupAnthropic].filter(Boolean) as Anthropic[];

      for (const client of clients) {
        try {
          const response = (await client.messages.create({
            model: VISION_MODEL as Parameters<typeof client.messages.create>[0]["model"],
            max_tokens: 1800,
            system:
              "You are FlowCreative's social strategist. Analyze creative media and return strict JSON for ready-to-post social copy, hashtags, and SEO keywords.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "image",
                    source: { type: "base64", media_type: image.mediaType, data: image.base64 },
                  },
                  { type: "text", text: prompt },
                ],
              },
            ],
          } as unknown as Parameters<typeof client.messages.create>[0])) as Anthropic.Message;
          const text = response.content.find((block) => block.type === "text");
          const parsed = parseJsonPayload(text?.type === "text" ? text.text : "");
          const prepared = normalizePreparedPost(parsed);
          if (prepared) {
            return {
              prepared,
              model: VISION_MODEL,
              prompt,
              raw: JSON.stringify(parsed || {}),
            };
          }
        } catch (error) {
          console.warn("[PrepareFromMedia] Anthropic vision attempt failed:", error);
        }
      }
    } catch (error) {
      console.warn("[PrepareFromMedia] Could not analyze image, falling back to text:", error);
    }
  }

  let fallback: PreparedPost | null = null;
  try {
    fallback = await ai.generateJSON<PreparedPost>(
      `${prompt}\n\nMedia URL/context: ${params.mediaUrl.startsWith("data:") ? "FlowCreative generated image data" : params.mediaUrl}`,
      {
        maxTokens: 1600,
        temperature: 0.6,
        systemPrompt:
          "You are FlowCreative's social strategist. Return strict JSON with ready-to-post caption, hashtags, SEO keywords, and a factual media description.",
      }
    );
  } catch (error) {
    console.warn("[PrepareFromMedia] Text generation attempt failed:", error);
  }

  const prepared = normalizePreparedPost(fallback) || buildFallbackPreparedPost({
    mediaType: params.mediaType,
    brandBrief: params.brandBrief,
    userPrompt: params.userPrompt,
    platforms: params.platforms,
  });
  return {
    prepared,
    model: fallback ? "gemini-2.5-flash" : "deterministic-fallback",
    prompt,
    raw: JSON.stringify(fallback || {}),
  };
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to prepare this post" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "FlowCreative post preparation", session.userId);
    if (gate) return gate;

    const validation = prepareFromMediaSchema.safeParse(await request.json().catch(() => ({})));
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid media preparation request",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const [captionCost, hashtagCost, seoCost, brandKit, user] = await Promise.all([
      getDynamicCreditCost("AI_CAPTION"),
      getDynamicCreditCost("AI_HASHTAGS"),
      getDynamicCreditCost("AI_SEO_OPTIMIZE"),
      loadBrandKit(session.userId),
      prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true, freeCredits: true },
      }),
    ]);

    const creditCost = captionCost + hashtagCost + seoCost;
    const isAdmin = !!session.adminId;
    const purchasedCredits = Math.max(0, (user?.aiCredits || 0) - (user?.freeCredits || 0));

    if (!isAdmin && purchasedCredits < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Preparing a ready-to-post FlowCreative caption requires ${creditCost} purchased credits. You have ${purchasedCredits}.`,
            cost: creditCost,
          },
        },
        { status: 403 }
      );
    }

    const data = validation.data;
    const platforms = normalizePlatforms(data.platforms);
    const brandBrief = [buildBrandBriefFromKit(brandKit), data.brandBrief || ""].filter(Boolean).join("\n\n");
    const startedAt = Date.now();
    const generated = await generatePreparedPost({
      request,
      mediaUrl: data.mediaUrl,
      mediaType: data.mediaType,
      brandBrief,
      platforms,
      userPrompt: data.prompt,
    });

    const inputTokens = ai.estimateTokens(generated.prompt);
    const outputText = JSON.stringify(generated.prepared);
    const outputTokens = ai.estimateTokens(outputText);
    const balanceAfter = (user?.aiCredits || 0) - creditCost;

    if (!isAdmin) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: creditCost } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -creditCost,
            balanceAfter,
            referenceType: "flowcreative_post_prepare",
            description: "FlowCreative: image analysis, caption, hashtags, and SEO keys",
            metadata: JSON.stringify({
              mediaType: data.mediaType,
              platforms,
              breakdown: {
                AI_CAPTION: captionCost,
                AI_HASHTAGS: hashtagCost,
                AI_SEO_OPTIMIZE: seoCost,
              },
            }),
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "flowcreative_post_prepare",
        model: generated.model,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - startedAt,
        prompt: generated.prompt.slice(0, 5000),
        response: outputText.slice(0, 5000),
      },
    });

    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "flowcreative_post",
        content: generated.prepared.caption,
        prompt: (data.prompt || generated.prepared.mediaDescription).slice(0, 500),
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({
          mediaType: data.mediaType,
          hashtags: generated.prepared.hashtags,
          seoKeywords: generated.prepared.seoKeywords,
        }),
        metadata: JSON.stringify({
          mediaDescription: generated.prepared.mediaDescription,
          model: generated.model,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...generated.prepared,
        platforms,
        creditsUsed: creditCost,
        creditsRemaining: isAdmin ? user?.aiCredits || 0 : balanceAfter,
      },
    });
  } catch (error) {
    console.error("Prepare post from media error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to prepare post from media",
        },
      },
      { status: 500 }
    );
  }
}
