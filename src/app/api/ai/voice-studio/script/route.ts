import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { generateScript } from "@/lib/voice/script-generator";

/**
 * POST /api/ai/voice-studio/script — Generate a voiceover script using AI
 *
 * Takes a topic and optional parameters, returns an AI-generated script
 * optimized for voiceover narration.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { topic, tone, duration, brandContext = false } = body;

    // Validate topic
    if (!topic || typeof topic !== "string" || topic.length < 1 || topic.length > 500) {
      return NextResponse.json(
        { error: "Topic must be between 1 and 500 characters" },
        { status: 400 }
      );
    }

    // Get credit cost
    const creditCost = await getDynamicCreditCost("AI_VOICE_SCRIPT");

    // Check credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Optionally fetch brand context
    let brandName: string | undefined;
    let brandDescription: string | undefined;

    if (brandContext) {
      const brandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
        select: { name: true, description: true },
      });

      if (brandKit) {
        brandName = brandKit.name || undefined;
        brandDescription = brandKit.description || undefined;
      }
    }

    // Generate script
    const result = await generateScript({
      topic,
      tone,
      duration,
      brandName,
      brandDescription,
    });

    // Deduct credits
    if (!isAdmin) {
      await prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: creditCost } },
      });

      await prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          amount: -creditCost,
          type: "USAGE",
          balanceAfter: (user?.aiCredits || 0) - creditCost,
          description: "AI voice script generation",
          referenceType: "ai_voice_script",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        script: result.script,
        estimatedDuration: result.estimatedDuration,
        wordCount: result.wordCount,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[VoiceStudio] Script generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Script generation failed" },
      { status: 500 }
    );
  }
}
