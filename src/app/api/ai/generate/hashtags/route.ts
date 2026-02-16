import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const generateHashtagsSchema = z.object({
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1),
  topic: z.string().min(5, "Topic must be at least 5 characters").max(500),
  count: z.number().min(5).max(30).default(15),
  categories: z.array(z.enum(["trending", "niche", "branded", "community"])).default(["trending", "niche"]),
});

const platformHashtagLimits = {
  instagram: { max: 30, recommended: 15 },
  twitter: { max: 5, recommended: 3 },
  linkedin: { max: 5, recommended: 3 },
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Please log in to generate content" },
        },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI hashtag generation");
    if (gate) return gate;

    const cost = await getDynamicCreditCost("AI_HASHTAGS");

    if (session.user.aiCredits < cost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: "You don't have enough AI credits. Please upgrade your plan.",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateHashtagsSchema.safeParse(body);

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

    const { platforms, topic, count, categories } = validation.data;
    const primaryPlatform = platforms[0] as keyof typeof platformHashtagLimits;
    const limits = platformHashtagLimits[primaryPlatform] || { max: 30, recommended: 15 };
    const actualCount = Math.min(count, limits.max);

    const prompt = buildHashtagPrompt({
      platforms,
      topic,
      count: actualCount,
      categories,
    });

    const response = await ai.generateJSON<{ hashtags: string[] }>(prompt, {
      maxTokens: 1024,
      temperature: 0.7,
      systemPrompt: `You are an expert social media hashtag strategist.
You understand hashtag trends, engagement patterns, and how to maximize reach.
You know which hashtags drive real engagement vs vanity hashtags.
Always return valid JSON with an array of hashtags.`,
    });

    if (!response || !response.hashtags) {
      throw new Error("Failed to parse hashtag response");
    }

    // Ensure hashtags start with #
    const hashtags = response.hashtags.map((tag: string) =>
      tag.startsWith("#") ? tag : `#${tag}`
    );

    // Track usage - for admin users, don't decrement credits but still track
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "hashtag_generation",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(JSON.stringify(hashtags)),
          model: "claude-sonnet-4-20250514",
        },
      });
    } else {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: cost } },
        }),
        prisma.aIUsage.create({
          data: {
            userId: session.userId,
            feature: "hashtag_generation",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(JSON.stringify(hashtags)),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to Generated Content Library
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "hashtags",
        content: hashtags.join(" "),
        prompt: topic,
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({ count, categories }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        hashtags,
        platforms,
        count: hashtags.length,
        categories,
        creditsUsed: cost,
        creditsRemaining: session.user.aiCredits - cost,
      },
    });
  } catch (error) {
    console.error("Hashtag generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate hashtags",
        },
      },
      { status: 500 }
    );
  }
}

function buildHashtagPrompt(params: {
  platforms: string[];
  topic: string;
  count: number;
  categories: string[];
}): string {
  const { platforms, topic, count, categories } = params;

  const platformList = platforms.map(p => p.toUpperCase()).join(", ");

  const categoryDescriptions: Record<string, string> = {
    trending: "currently trending and popular hashtags with high engagement",
    niche: "specific hashtags targeting your exact audience and industry",
    branded: "unique branded hashtags for building recognition",
    community: "community and engagement hashtags that encourage interaction",
  };

  const categoryRequests = categories
    .map((cat) => `- ${categoryDescriptions[cat]}`)
    .join("\n");

  return `Generate ${count} strategic hashtags for ${platformList} about: ${topic}

Include a mix of:
${categoryRequests}

Requirements:
- Make sure hashtags are relevant to the topic
- Mix popular high-reach hashtags with niche targeted ones
- Avoid banned or spammy hashtags
- Each hashtag should be lowercase with no spaces
- Don't repeat similar variations
- Optimize for engagement across all selected platforms

Return ONLY a JSON object in this exact format:
{
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", ...]
}

No explanations, just the JSON.`;
}
