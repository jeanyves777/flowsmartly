import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { ai } from "@/lib/ai/client";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";

const generateIdeasSchema = z.object({
  brand: z.string().min(3, "Brand name must be at least 3 characters").max(200),
  industry: z.string().min(3, "Industry must be at least 3 characters").max(200),
  platforms: z.array(z.enum(["instagram", "twitter", "linkedin", "facebook", "youtube"])).min(1),
  contentPillars: z.array(
    z.enum(["educational", "entertaining", "inspiring", "promotional", "behind-scenes", "user-generated"])
  ).min(1, "Select at least one content pillar"),
  count: z.number().min(3).max(10).default(5),
});

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

    const gate = await checkPlanAccess(session.user.plan, "AI idea generation", session.userId);
    if (gate) return gate;

    const cost = await getDynamicCreditCost("AI_IDEAS");

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_IDEAS", !!session.adminId);
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = generateIdeasSchema.safeParse(body);

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

    const { brand, industry, platforms, contentPillars, count } = validation.data;

    const prompt = buildIdeasPrompt({
      brand,
      industry,
      platforms,
      contentPillars,
      count,
    });

    const response = await ai.generateJSON<{
      ideas: Array<{ title: string; description: string; pillar: string }>
    }>(prompt, {
      maxTokens: 2048,
      temperature: 0.9,
      systemPrompt: `You are an expert content strategist and social media marketing specialist.
You create innovative, engaging content ideas that drive brand awareness and engagement.
You understand current trends, audience psychology, and what makes content go viral.
Always return valid JSON with creative, actionable content ideas.`,
    });

    if (!response || !response.ideas) {
      throw new Error("Failed to parse ideas response");
    }

    // Track usage - for admin users, don't decrement credits but still track
    if (session.adminId) {
      await prisma.aIUsage.create({
        data: {
          adminId: session.adminId,
          userId: null,
          feature: "idea_generation",
          inputTokens: ai.estimateTokens(prompt),
          outputTokens: ai.estimateTokens(JSON.stringify(response.ideas)),
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
            feature: "idea_generation",
            inputTokens: ai.estimateTokens(prompt),
            outputTokens: ai.estimateTokens(JSON.stringify(response.ideas)),
            model: "claude-sonnet-4-20250514",
          },
        }),
      ]);
    }

    // Save to Generated Content Library
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "ideas",
        content: JSON.stringify(response.ideas),
        prompt: `${brand} - ${industry}`,
        platforms: JSON.stringify(platforms),
        settings: JSON.stringify({ contentPillars, count }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ideas: response.ideas,
        platforms,
        contentPillars,
        creditsUsed: cost,
        creditsRemaining: session.user.aiCredits - cost,
      },
    });
  } catch (error) {
    console.error("Ideas generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GENERATION_FAILED",
          message: error instanceof Error ? error.message : "Failed to generate content ideas",
        },
      },
      { status: 500 }
    );
  }
}

function buildIdeasPrompt(params: {
  brand: string;
  industry: string;
  platforms: string[];
  contentPillars: string[];
  count: number;
}): string {
  const { brand, industry, platforms, contentPillars, count } = params;

  const platformList = platforms.map(p => p.toUpperCase()).join(", ");

  const pillarDescriptions: Record<string, string> = {
    educational: "teaching valuable skills or knowledge to your audience",
    entertaining: "fun, engaging content that entertains and delights",
    inspiring: "motivational content that inspires and uplifts",
    promotional: "showcasing products, services, or special offers",
    "behind-scenes": "authentic glimpses into your company culture and process",
    "user-generated": "content that encourages audience participation and sharing",
  };

  const pillarRequests = contentPillars
    .map((pillar) => `- ${pillar.charAt(0).toUpperCase() + pillar.slice(1)}: ${pillarDescriptions[pillar]}`)
    .join("\n");

  return `Generate ${count} creative content ideas for: ${platformList}

Brand: ${brand}
Industry: ${industry}

Content pillars to cover:
${pillarRequests}

Requirements:
- Make ideas specific and actionable
- Each idea should be unique and creative
- Consider current trends and viral potential
- Ideas should be feasible to create
- Include a mix of content formats optimized for the selected platforms
- Ensure ideas work well across all selected platforms

Return ONLY a JSON object in this exact format:
{
  "ideas": [
    {
      "title": "Brief catchy title for the idea",
      "description": "2-3 sentence description explaining the content idea, format, and what makes it engaging",
      "pillar": "the content pillar this falls under"
    }
  ]
}

No explanations, just the JSON.`;
}
