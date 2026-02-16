import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ai } from "@/lib/ai/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";

/**
 * POST /api/ai/video-studio/ideas — Generate video prompt ideas based on brand identity
 *
 * Uses AI to suggest 3 creative video ad prompts tailored to the user's brand,
 * selected category, and style.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { category = "product_ad", style = "cinematic", provider = "veo3" } = body;

    // Get credit cost for ideas (same as AI_IDEAS = 5 credits)
    const creditCost = await getDynamicCreditCost("AI_IDEAS");

    // Check credits
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

    // Fetch brand identity
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

    const prompt = buildVideoIdeasPrompt(brandKit, category, style, provider);

    const result = await ai.generateJSON<{ ideas: string[] }>(prompt, {
      maxTokens: 1024,
      temperature: 0.9,
      systemPrompt:
        "You are a creative marketing strategist who helps businesses come up with real, actionable video ad concepts. You propose specific promotional offers, product highlights, seasonal campaigns, and engaging marketing angles — NOT technical camera or animation descriptions. Think like a marketing director pitching ad concepts to a client. Return ONLY valid JSON.",
    });

    if (!result?.ideas || !Array.isArray(result.ideas) || result.ideas.length === 0) {
      throw new Error("Failed to generate video ideas");
    }

    // Deduct credits
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
            referenceType: "ai_video_ideas",
            description: "Video studio: AI prompt ideas",
          },
        }),
      ]);
    }

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "video_studio_ideas",
        model: "claude-sonnet-4-20250514",
        inputTokens: ai.estimateTokens(prompt),
        outputTokens: ai.estimateTokens(JSON.stringify(result.ideas)),
        costCents: 0,
      },
    });

    // Save to history so user can reuse past ideas
    await prisma.generatedContent.create({
      data: {
        userId: session.userId,
        type: "video_ideas",
        content: JSON.stringify(result.ideas.slice(0, 5)),
        prompt: `${category} / ${style} / ${provider}`,
        settings: JSON.stringify({ category, style, provider }),
      },
    });

    return NextResponse.json({
      ideas: result.ideas.slice(0, 5),
      creditsUsed: creditCost,
      creditsRemaining: (user?.aiCredits || 0) - creditCost,
    });
  } catch (error) {
    console.error("[VideoStudio] Ideas generation error:", error);
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

function buildVideoIdeasPrompt(
  brand: BrandContext | null,
  category: string,
  style: string,
  provider: string
): string {
  const brandName = brand?.name || "your brand";

  const categoryGoals: Record<string, string> = {
    product_ad: "showcase a specific product with a compelling offer or unique selling point",
    promo: "promote a limited-time sale, discount, seasonal deal, or special event",
    social_reel: "create a catchy, scroll-stopping short-form video for social media (Instagram/TikTok)",
    explainer: "explain how a product or service works, or educate the audience about something valuable",
    brand_intro: "introduce the brand story, mission, or what makes it unique",
    testimonial: "highlight a customer success story or showcase real results and reviews",
  };

  const catGoal = categoryGoals[category] || "create a marketing video";

  // Build brand context
  const brandLines: string[] = [`Brand name: "${brandName}"`];
  if (brand?.industry) brandLines.push(`Industry: ${brand.industry}`);
  if (brand?.niche) brandLines.push(`Niche: ${brand.niche}`);
  if (brand?.description) brandLines.push(`About: ${brand.description}`);
  if (brand?.tagline) brandLines.push(`Tagline: "${brand.tagline}"`);
  if (brand?.targetAudience) brandLines.push(`Target audience: ${brand.targetAudience}`);
  if (brand?.voiceTone) brandLines.push(`Brand voice: ${brand.voiceTone}`);
  const brandContext = brandLines.join("\n");

  if (provider === "slideshow") {
    return `Generate exactly 5 real marketing video concepts for this brand:

${brandContext}

Goal: ${catGoal}
Format: 45-second narrated slideshow video

Each idea should be a SPECIFIC, ACTIONABLE marketing concept — the kind a marketing director would pitch. Include:
- The actual offer, promotion, or message (e.g., "Buy one get one free on our signature burgers this weekend")
- Who it targets and why it would resonate
- The story or angle for the slideshow narration

Do NOT describe camera movements or technical details. Focus on WHAT the ad says and promotes, not how it looks technically.

Examples of GOOD ideas:
- "Weekend Flash Sale: 40% off all winter coats — announce the sale with customer photos wearing the coats in snowy settings"
- "New menu item launch: Our wood-fired margherita pizza, highlight the fresh ingredients and the $9.99 introductory price"
- "Customer spotlight: Sarah lost 30 pounds in 3 months using our meal plans — tell her transformation story"

Return JSON: { "ideas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"] }`;
  }

  return `Generate exactly 5 real marketing video ad concepts for this brand:

${brandContext}

Goal: ${catGoal}
Visual style: ${style}

Each idea should be a SPECIFIC, ACTIONABLE marketing concept — the kind a marketing director would pitch. Include:
- The actual offer, product, or message being promoted
- A concrete visual concept that would make a great short video ad
- Any specific deals, prices, dates, or calls-to-action

Do NOT focus on technical camera movements. Focus on WHAT the ad promotes and the marketing message. The AI will handle the visuals.

Examples of GOOD ideas:
- "Happy Hour Special: $5 margaritas every Friday 5-8 PM — show a vibrant bar scene with friends clinking colorful cocktails and laughing"
- "New Arrivals: Spring 2026 collection just dropped — model walking through a flower garden wearing the new floral dress line, starting at $49"
- "Free Shipping Weekend: Order by Sunday and get free express delivery — show packages flying out of a warehouse and landing on doorsteps"

Return JSON: { "ideas": ["idea 1", "idea 2", "idea 3", "idea 4", "idea 5"] }`;
}
