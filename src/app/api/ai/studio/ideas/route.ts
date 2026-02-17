import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

/**
 * POST /api/ai/studio/ideas — Generate design prompt ideas based on brand identity
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
        { error: "Insufficient credits", required: creditCost, available: user?.aiCredits || 0 },
        { status: 402 }
      );
    }

    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: {
        name: true,
        voiceTone: true,
        description: true,
        tagline: true,
        industry: true,
        niche: true,
        targetAudience: true,
      },
    });

    const prompt = buildDesignIdeasPrompt(brandKit, category, style);

    const result = await ai.generateJSON<{ ideas: string[] }>(prompt, {
      maxTokens: 1024,
      temperature: 0.9,
      systemPrompt:
        "You are a creative graphic designer and marketing strategist. You suggest specific, actionable design concepts with concrete visual details, copy ideas, and marketing angles. Return ONLY valid JSON.",
    });

    if (!result?.ideas || !Array.isArray(result.ideas) || result.ideas.length === 0) {
      throw new Error("Failed to generate design ideas");
    }

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
        feature: "design_studio_ideas",
        model: "claude-sonnet-4-20250514",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(JSON.stringify(result.ideas)),
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
      ideas: result.ideas.slice(0, 5),
      creditsUsed: creditCost,
      creditsRemaining: (user?.aiCredits || 0) - creditCost,
    });
  } catch (error) {
    console.error("[DesignStudio] Ideas generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate ideas" },
      { status: 500 }
    );
  }
}

interface BrandContext {
  name: string | null;
  voiceTone: string | null;
  description: string | null;
  tagline: string | null;
  industry: string | null;
  niche: string | null;
  targetAudience: string | null;
}

function buildDesignIdeasPrompt(
  brand: BrandContext | null,
  category: string,
  style: string
): string {
  const brandName = brand?.name || "your brand";

  const categoryGoals: Record<string, string> = {
    social_post: "create an engaging social media post graphic",
    ad: "design a compelling advertisement visual",
    flyer: "create a professional flyer or promotional handout",
    poster: "design an eye-catching poster",
    banner: "create a professional banner (web, social, or print)",
    signboard: "design a storefront or directional signboard",
  };

  const catGoal = categoryGoals[category] || "create a professional design";

  const brandLines: string[] = [`Brand name: "${brandName}"`];
  if (brand?.industry) brandLines.push(`Industry: ${brand.industry}`);
  if (brand?.niche) brandLines.push(`Niche: ${brand.niche}`);
  if (brand?.description) brandLines.push(`About: ${brand.description}`);
  if (brand?.tagline) brandLines.push(`Tagline: "${brand.tagline}"`);
  if (brand?.targetAudience) brandLines.push(`Target audience: ${brand.targetAudience}`);
  if (brand?.voiceTone) brandLines.push(`Brand voice: ${brand.voiceTone}`);
  const brandContext = brandLines.join("\n");

  return `Generate exactly 5 specific design concepts for this brand:

${brandContext}

Goal: ${catGoal}
Visual style: ${style}

Each idea should be a SPECIFIC, ACTIONABLE design brief — describe the visual concept, the headline/copy, and the marketing angle. Include:
- The main message or promotion
- Visual composition and key elements
- Suggested headline or copy text

Examples of GOOD ideas:
- "Summer Sale Announcement: Bold '50% OFF' headline over a split background of bright coral and teal, featuring sunglasses and beach accessories arranged in a flat-lay style"
- "New Product Launch: Minimalist hero shot of the wireless earbuds floating on a gradient background, headline 'Sound Reimagined' with specs listed below"
- "Customer Testimonial Post: Quote card with customer photo in a circular frame, their review in elegant serif font on a soft cream background with gold accents"

Return JSON: { "ideas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"] }`;
}
