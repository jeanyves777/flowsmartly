import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { aiHub } from "@/lib/ai";
import { getDynamicCreditCost } from "@/lib/credits/costs";

const audienceSchema = z.object({
  campaignName: z.string().optional(),
  objective: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  postSummaries: z.array(z.string()).optional(),
  existingTags: z.array(z.string()).optional(),
});

interface AudienceTag {
  label: string;
  category: "age" | "gender" | "interest" | "behavior" | "location" | "income" | "device";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in" } },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI audience targeting");
    if (gate) return gate;

    const body = await request.json();
    const validation = audienceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
        { status: 400 }
      );
    }

    const { campaignName, objective, platforms, postSummaries, existingTags } = validation.data;

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const cost = await getDynamicCreditCost("AI_AUDIENCE");
    const credits = session.adminId ? (session.user.aiCredits ?? 0) : (user?.aiCredits ?? 0);

    if (credits < cost) {
      return NextResponse.json(
        { success: false, error: { code: "INSUFFICIENT_CREDITS", message: "Not enough AI credits" } },
        { status: 403 }
      );
    }

    // Get brand context for richer suggestions
    const brandContext = await aiHub.getBrandContext(session.userId);

    // Build prompt
    const contextParts: string[] = [];

    if (campaignName) contextParts.push(`Campaign: "${campaignName}"`);
    if (objective) contextParts.push(`Objective: ${objective}`);
    if (platforms?.length) contextParts.push(`Target platforms: ${platforms.join(", ")}`);
    if (postSummaries?.length) {
      contextParts.push(`Post content being promoted:\n${postSummaries.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
    }
    if (existingTags?.length) {
      contextParts.push(`Already selected tags (suggest different/complementary ones): ${existingTags.join(", ")}`);
    }
    if (brandContext) {
      const brandParts: string[] = [];
      if (brandContext.industry) brandParts.push(`Industry: ${brandContext.industry}`);
      if (brandContext.niche) brandParts.push(`Niche: ${brandContext.niche}`);
      if (brandContext.targetAudience) brandParts.push(`Existing target audience: ${brandContext.targetAudience}`);
      if (brandContext.audienceAge) brandParts.push(`Age range: ${brandContext.audienceAge}`);
      if (brandContext.audienceLocation) brandParts.push(`Location: ${brandContext.audienceLocation}`);
      if (brandParts.length) contextParts.push(`Brand info:\n${brandParts.join("\n")}`);
    }

    const prompt = `You are an expert digital advertising strategist. Based on the campaign context below, suggest audience targeting tags.

${contextParts.length > 0 ? contextParts.join("\n\n") : "No specific context — suggest versatile audience tags."}

Return a JSON array of 8-12 targeting tags. Each tag must have:
- "label": short display text (2-4 words max, e.g. "18-24 years old", "Fashion lovers", "United States")
- "category": one of "age", "gender", "interest", "behavior", "location", "income", "device"

Provide a diverse mix across categories. Be specific and actionable.

Example format:
[
  {"label": "18-24 years old", "category": "age"},
  {"label": "Fashion & Style", "category": "interest"},
  {"label": "Online shoppers", "category": "behavior"},
  {"label": "United States", "category": "location"}
]

Return ONLY the JSON array.`;

    const result = await ai.generateJSON<AudienceTag[]>(prompt, {
      maxTokens: 500,
      temperature: 0.8,
      systemPrompt: "You are a digital advertising expert. Return only valid JSON arrays of audience targeting tags.",
    });

    const tags: AudienceTag[] = Array.isArray(result)
      ? result.filter(t => t.label && t.category).slice(0, 15)
      : [];

    // Deduct credits and track usage
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "audience_targeting",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(JSON.stringify(tags)),
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
            feature: "audience_targeting",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(JSON.stringify(tags)),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to history
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "audience_tags",
        content: JSON.stringify(tags),
        prompt: campaignName || "audience",
        settings: JSON.stringify({ objective, platforms }),
      },
    });

    const creditsRemaining = session.adminId
      ? credits - cost
      : (await prisma.user.findUnique({ where: { id: session.userId }, select: { aiCredits: true } }))?.aiCredits ?? 0;

    return NextResponse.json({
      success: true,
      data: {
        tags,
        creditsUsed: cost,
        creditsRemaining,
      },
    });
  } catch (error) {
    console.error("Audience generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate audience targeting" } },
      { status: 500 }
    );
  }
}
