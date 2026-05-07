import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { geminiText as ai } from "@/lib/ai/gemini-text-client";
import { prisma } from "@/lib/db/client";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";

const seoKeywordSchema = z.object({
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).default(["facebook"]),
  caption: z.string().min(10, "Caption must be at least 10 characters").max(2000),
  brandBrief: z.string().max(2500).optional(),
  count: z.number().min(5).max(15).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to generate SEO keys" } },
        { status: 401 }
      );
    }

    const gate = await checkPlanAccess(session.user.plan, "AI SEO keyword generation", session.userId);
    if (gate) return gate;

    const creditCost = await getDynamicCreditCost("AI_SEO_OPTIMIZE");
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_SEO_OPTIMIZE", !!session.adminId);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    const validation = seoKeywordSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: validation.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { platforms, caption, brandBrief, count } = validation.data;
    const prompt = buildSeoKeywordPrompt({
      platforms,
      caption,
      brandBrief: brandBrief || "",
      count,
      currentDate: new Date().toISOString().slice(0, 10),
    });

    const response = await ai.generateJSON<{ keywords?: string[]; seoKeywords?: string[]; tags?: string[] }>(prompt, {
      maxTokens: 900,
      temperature: 0.55,
      systemPrompt:
        "You are a social SEO strategist. Return only valid JSON with search-ready keyword phrases. No explanations.",
    });

    const keywords = normalizeSeoKeywords(response?.keywords || response?.seoKeywords || response?.tags || [], count);
    if (keywords.length === 0) {
      throw new Error("AI did not return usable SEO keys");
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!session.adminId) {
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
            balanceAfter: (user?.aiCredits || 0) - creditCost,
            referenceType: "ai_seo_keywords",
            description: "Post creation: AI SEO keys",
          },
        }),
        prisma.aIUsage.create({
          data: {
            userId: session.userId,
            feature: "seo_keyword_generation",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(JSON.stringify(keywords)),
            model: "gemini-2.5-flash",
          },
        }),
      ]);
    } else {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "seo_keyword_generation",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(JSON.stringify(keywords)),
          model: "gemini-2.5-flash",
        },
      });
    }

    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "seo_keywords",
        content: keywords.join(", "),
        prompt: caption.slice(0, 500),
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({ count }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        keywords,
        creditsUsed: creditCost,
        creditsRemaining: session.adminId ? user?.aiCredits || 0 : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("SEO keyword generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate SEO keys",
        },
      },
      { status: 500 }
    );
  }
}

function normalizeSeoKeywords(value: unknown, limit: number): string[] {
  const raw = extractKeywordCandidates(value);
  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const candidate of raw) {
    const cleaned = String(candidate)
      .trim()
      .replace(/^#+/, "")
      .replace(/[^\p{L}\p{N}\s&+\-']/gu, "")
      .replace(/\s{2,}/g, " ")
      .toLowerCase();
    if (cleaned.length < 3 || seen.has(cleaned)) continue;
    seen.add(cleaned);
    keywords.push(cleaned);
    if (keywords.length >= limit) break;
  }

  return keywords;
}

function extractKeywordCandidates(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((item) => extractKeywordCandidates(item));
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractKeywordCandidates(record.keywords || record.seoKeywords || record.tags || Object.values(record));
  }
  const text = String(value);
  return text
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildSeoKeywordPrompt(params: {
  platforms: string[];
  caption: string;
  brandBrief: string;
  count: number;
  currentDate: string;
}) {
  const { platforms, caption, brandBrief, count, currentDate } = params;
  return `Generate ${count} up-to-date social SEO keyword phrases for this post.

Date: ${currentDate}
Selected platforms: ${platforms.join(", ")}

Brand context:
${brandBrief || "No saved brand brief."}

Caption:
${caption}

Rules:
- Return customer-search phrases, not hashtags.
- Mix buyer-intent terms, product/service terms, niche discovery terms, and local/audience terms when relevant.
- Keep each keyword phrase 2-5 words.
- Do not repeat hashtags already present in the caption.
- Avoid spammy, banned, misleading, or overbroad keywords.
- Keep phrases relevant to the actual caption and brand.

Return ONLY JSON:
{
  "keywords": ["keyword phrase", "keyword phrase"]
}`;
}
