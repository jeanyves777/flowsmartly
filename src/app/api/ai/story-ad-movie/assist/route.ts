import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";

type AssistMode = "ideas" | "story" | "script" | "character";

interface ReferenceMediaInput {
  url: string;
  scene?: string | null;
  note?: string | null;
  type?: string | null;
}

interface AssistResponse {
  brief?: string;
  characterBrief?: string;
  ideas?: Array<{
    title: string;
    brief: string;
    hook?: string;
  }>;
  sceneScripts?: Array<{
    scene: string;
    script: string;
  }>;
}

function parseArray(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function normalizeMode(value: unknown): AssistMode {
  return value === "ideas" || value === "story" || value === "script" || value === "character"
    ? value
    : "story";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 8);
}

function normalizeReferenceMedia(value: unknown): ReferenceMediaInput[] {
  if (!Array.isArray(value)) return [];
  const normalized: ReferenceMediaInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    if (!url) continue;
    normalized.push({
      url,
      scene: typeof record.scene === "string" ? record.scene.trim().slice(0, 120) : null,
      note: typeof record.note === "string" ? record.note.trim().slice(0, 400) : null,
      type: typeof record.type === "string" ? record.type.trim().slice(0, 20) : null,
    });
  }
  return normalized.slice(0, 12);
}

async function getBrandContext(userId: string) {
  const brand = await prisma.brandKit.findFirst({
    where: { userId, isDefault: true },
  }).then((defaultBrand) =>
    defaultBrand || prisma.brandKit.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } })
  );

  if (!brand) return "No saved brand identity yet. Use the user's brief as the source of truth.";

  return [
    `Brand: ${brand.name}`,
    brand.tagline ? `Tagline: ${brand.tagline}` : null,
    brand.description ? `Description: ${brand.description}` : null,
    brand.industry ? `Industry: ${brand.industry}` : null,
    brand.niche ? `Niche: ${brand.niche}` : null,
    brand.targetAudience ? `Audience: ${brand.targetAudience}` : null,
    brand.voiceTone ? `Voice: ${brand.voiceTone}` : null,
    brand.uniqueValue ? `Value: ${brand.uniqueValue}` : null,
    parseArray(brand.products).length ? `Products/services: ${parseArray(brand.products).join(", ")}` : null,
    parseArray(brand.keywords).length ? `Keywords: ${parseArray(brand.keywords).join(", ")}` : null,
    parseArray(brand.personality).length ? `Personality: ${parseArray(brand.personality).join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

function buildAssistPrompt(params: {
  mode: AssistMode;
  brandContext: string;
  brief: string;
  goal: string;
  platforms: string[];
  characterBrief: string;
  referenceMedia: ReferenceMediaInput[];
}) {
  const referenceContext = params.referenceMedia.length
    ? params.referenceMedia.map((item, index) => [
        `${index + 1}. ${item.type || "media"} reference`,
        item.scene ? `scene/script: ${item.scene}` : null,
        item.note ? `instruction: ${item.note}` : null,
      ].filter(Boolean).join(" | ")).join("\n")
    : "No reference media yet.";

  const base = `BRAND
${params.brandContext}

CURRENT USER BRIEF
${params.brief || "No detailed brief yet."}

GOAL
${params.goal || "Drive attention, trust, and action."}

SOCIAL DESTINATIONS
${params.platforms.length ? params.platforms.join(", ") : "Not selected yet"}

CHARACTER OR TALENT NOTES
${params.characterBrief || "No character/talent defined yet."}

REFERENCE MEDIA AND SCENE NOTES
${referenceContext}`;

  if (params.mode === "ideas") {
    return `${base}

Generate 4 advertising still-movie concepts. Each one must be easy for a business owner to understand and ready to use as a creative direction.

Return strict JSON:
{
  "ideas": [
    { "title": "Short title", "brief": "Complete story ad movie brief", "hook": "Why it works" }
  ]
}`;
  }

  if (params.mode === "character") {
    return `${base}

Create one concise character/talent direction for this ad movie. It may be a spokesperson, customer, product hero, founder, or lifestyle scene. Include look, role, emotion, movement, and how uploaded media should be respected.

Return strict JSON:
{
  "characterBrief": "Character/talent direction"
}`;
  }

  if (params.mode === "script") {
    return `${base}

Write a scene-by-scene script for a direct xAI video ad. Keep it compact and cinematic. Include where each uploaded reference should influence the scene when scene notes are provided.

Return strict JSON:
{
  "brief": "One complete production brief ready for the video generator",
  "sceneScripts": [
    { "scene": "Scene 1", "script": "Scene script and visual direction" }
  ]
}`;
  }

  return `${base}

Rewrite the user's rough idea into one polished direct xAI video-generation brief. It should explain the story, audience, offer, visual tone, motion, character/talent, references, platform fit, and CTA. Keep it business-ready and not technical.

Return strict JSON:
{
  "brief": "Complete production brief"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const mode = normalizeMode(body.mode);
    const platforms = normalizeStringArray(body.platforms);
    const referenceMedia = normalizeReferenceMedia(body.referenceMedia);
    const brief = typeof body.brief === "string" ? body.brief.trim().slice(0, 3000) : "";
    const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 500) : "";
    const characterBrief = typeof body.characterBrief === "string" ? body.characterBrief.trim().slice(0, 1000) : "";

    const cost = await getDynamicCreditCost("AI_IDEAS");
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_IDEAS", !!session.adminId);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: creditCheck.code === "INSUFFICIENT_CREDITS" ? 402 : 403 },
      );
    }

    const brandContext = await getBrandContext(session.userId);
    const prompt = buildAssistPrompt({
      mode,
      brandContext,
      brief,
      goal,
      platforms,
      characterBrief,
      referenceMedia,
    });

    const result = await ai.generateJSON<AssistResponse>(prompt, {
      maxTokens: mode === "ideas" ? 2400 : 1800,
      temperature: mode === "ideas" ? 0.9 : 0.72,
      systemPrompt:
        "You are FlowSmartly's senior advertising story director. Return valid JSON only. Hide provider/backend details from users and write practical customer-facing creative direction.",
    });

    if (!result) {
      throw new Error("AI did not return a usable result");
    }

    let creditsRemaining: number | undefined;
    if (!session.adminId) {
      const charge = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: cost,
        referenceType: "story_ad_movie_assist",
        description: `Story Ad Movie AI ${mode}`,
        metadata: { mode },
      });
      if (!charge.success) {
        return NextResponse.json(
          { success: false, error: { code: "INSUFFICIENT_CREDITS", message: charge.error || "Insufficient credits" } },
          { status: 402 },
        );
      }
      creditsRemaining = charge.transaction?.balanceAfter;
    }

    await prisma.aIUsage.create({
      data: {
        userId: session.adminId ? null : session.userId,
        adminId: session.adminId || null,
        feature: "story_ad_movie_assist",
        model: "claude-opus-4-7",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(JSON.stringify(result)),
        prompt: mode,
        response: JSON.stringify(result).slice(0, 1000),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        creditsUsed: session.adminId ? 0 : cost,
        creditsRemaining,
      },
    });
  } catch (error) {
    console.error("Story ad movie assist error:", error);
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: "Failed to create AI assistance" } },
      { status: 500 },
    );
  }
}
