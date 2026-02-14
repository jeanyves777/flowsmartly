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
    const { category = "product_ad", style = "cinematic", provider = "grok" } = body;

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
      select: { name: true, voiceTone: true, colors: true },
    });

    const brandName = brandKit?.name || "your brand";
    const voiceTone = brandKit?.voiceTone || "professional";

    const prompt = buildVideoIdeasPrompt(brandName, voiceTone, category, style, provider);

    const result = await ai.generateJSON<{ ideas: string[] }>(prompt, {
      maxTokens: 1024,
      temperature: 0.9,
      systemPrompt:
        "You are a creative video marketing strategist. Generate compelling, specific video ad prompts that would work well with AI video generation. Return ONLY valid JSON.",
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

    return NextResponse.json({
      ideas: result.ideas.slice(0, 3),
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

function buildVideoIdeasPrompt(
  brandName: string,
  voiceTone: string,
  category: string,
  style: string,
  provider: string
): string {
  const categoryDescriptions: Record<string, string> = {
    product_ad: "product advertisement showcasing a product with dynamic visuals",
    promo: "promotional video for a sale, event, or special offer",
    social_reel: "short-form social media reel (Instagram/TikTok style)",
    explainer: "explainer video that educates viewers about a product or concept",
    brand_intro: "brand introduction video that establishes brand identity",
    testimonial: "customer testimonial or review-style video",
  };

  const catDesc = categoryDescriptions[category] || "marketing video";

  if (provider === "slideshow") {
    return `Generate exactly 3 creative narrated slideshow video ideas for "${brandName}".

Brand voice/tone: ${voiceTone}
Video type: ${catDesc}
Visual style: ${style}
Format: 45-second slideshow with 6-8 AI-generated images, voiceover narration, and on-screen captions

Each idea should be a compelling narrative concept (2-3 sentences) describing a STORY that unfolds across multiple scenes. Focus on the narrative arc, visual scenes (what each image would show), and the voiceover message. Think of it as a narrated photo essay or visual story — NOT an animated video. Describe the scenes, the mood, and the message the voiceover would deliver.

Return JSON: { "ideas": ["idea 1", "idea 2", "idea 3"] }`;
  }

  return `Generate exactly 3 creative video ad prompts for "${brandName}".

Brand voice/tone: ${voiceTone}
Video type: ${catDesc}
Visual style: ${style}

Each prompt should be a detailed, vivid description (2-3 sentences) that an AI video generator can use to create a compelling ${catDesc}. CRITICAL: Every prompt MUST describe real physical motion and animation — objects moving, camera panning/zooming/orbiting, elements sliding or flying in, people walking or gesturing, particles flowing. Never describe a static scene. Include specific camera movements (dolly, tracking, zoom, orbit), object motion, and dynamic transitions.

Return JSON: { "ideas": ["prompt 1", "prompt 2", "prompt 3"] }`;
}
