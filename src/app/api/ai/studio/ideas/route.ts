import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { buildStudioTools } from "@/lib/ai/studio-tools";
import { getDynamicCreditCost } from "@/lib/credits/costs";

/**
 * POST /api/ai/studio/ideas — Generate design prompt ideas based on brand identity
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { category = "social_post", style = "modern" } = body;

    const creditCost = await getDynamicCreditCost("AI_IDEAS");

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: "Insufficient credits",
            required: creditCost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 }
      );
    }

    // Agent loop: gives Claude access to brand kit, recent designs, and
    // typography pairings so its ideas are grounded in the user's actual data.
    const tools = buildStudioTools({ userId: session.userId });
    const agentRun = await ai.runWithTools<{ ideas: string[] }>(
      buildDesignIdeasAgentPrompt(category, style),
      tools,
      {
        maxTokens: 4096,
        temperature: 0.9,
        maxIterations: 6,
        thinkingBudget: 1500, // Extended thinking — API forces temperature=1 internally
        systemPrompt: AGENT_SYSTEM_PROMPT,
      },
    );

    const ideas = agentRun.json?.ideas;
    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      throw new Error("Agent did not return any design ideas");
    }
    const result = { ideas };

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
            balanceAfter: (user?.aiCredits || 0) - creditCost,
            referenceType: "ai_design_ideas",
            description: "Design studio: AI prompt ideas",
          },
        }),
      ]);
    }

    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "design_studio_ideas_agent",
        model: "claude-opus-4-7",
        inputTokens: agentRun.usage.inputTokens,
        outputTokens: agentRun.usage.outputTokens,
        costCents: 0,
      },
    });

    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "design_ideas",
        content: JSON.stringify(result.ideas.slice(0, 5)),
        prompt: `${category} / ${style}`,
        settings: JSON.stringify({ category, style }),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ideas: result.ideas.slice(0, 5),
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
      },
      // Backwards-compatible top-level fields for any older clients still reading them
      ideas: result.ideas.slice(0, 5),
      creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - creditCost,
    });
  } catch (error) {
    console.error("[DesignStudio] Ideas generation error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : "Failed to generate ideas" },
      },
      { status: 500 }
    );
  }
}

const AGENT_SYSTEM_PROMPT = `You are a creative graphic designer and marketing strategist working inside FlowSmartly's design studio.

You have access to tools that let you look up the user's brand kit, their recent designs, and curated typography pairings. Use these tools to ground your suggestions in real data — do NOT guess at the brand name or invent design history.

Workflow on every request:
1. Call get_brand_kit to learn the brand. If it returns configured: false, proceed with industry-generic ideas.
2. Call get_recent_designs_in_category to avoid repeating concepts the user has already created.
3. Optionally call get_typography_pairings if the style benefits from a font recommendation.
4. Generate exactly 5 specific, actionable design briefs and return them as JSON.

Your final answer MUST be ONLY valid JSON in this shape:
{ "ideas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"] }

No markdown, no preamble, no commentary outside the JSON.`;

function buildDesignIdeasAgentPrompt(category: string, style: string): string {
  const categoryGoals: Record<string, string> = {
    social_post: "create an engaging social media post graphic",
    ad: "design a compelling advertisement visual",
    flyer: "create a professional flyer or promotional handout",
    poster: "design an eye-catching poster",
    banner: "create a professional banner (web, social, or print)",
    signboard: "design a storefront or directional signboard",
  };
  const catGoal = categoryGoals[category] || "create a professional design";

  return `Generate 5 specific design concepts.

Goal: ${catGoal}
Visual style: ${style}
Category: ${category}

Each idea should be a SPECIFIC, ACTIONABLE design brief — describe the visual composition, the headline/copy, and the marketing angle in one sentence (~30-50 words).

Examples of GOOD ideas:
- "Summer Sale Announcement: Bold '50% OFF' headline over a split background of bright coral and teal, featuring sunglasses and beach accessories arranged in a flat-lay style"
- "New Product Launch: Minimalist hero shot of the wireless earbuds floating on a gradient background, headline 'Sound Reimagined' with specs listed below"

Use your tools to ground these in the user's brand. Return only the JSON.`;
}
