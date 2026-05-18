import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { listCartoonVideos } from "@/lib/cartoon";
import { presignAllUrls } from "@/lib/utils/s3-client";
import {
  normalizeStoryAdMovieInput,
  processStoryAdMovie,
} from "@/lib/story-ad-movie";

// POST /api/ai/cartoon
// Rebuilt as Story Ad Movie: users provide one brief, FlowSmartly plans,
// illustrates, voices, and composites a story-driven advertising video.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const input = normalizeStoryAdMovieInput(body);

    if (input.brief.length < 12) {
      return NextResponse.json(
        { success: false, error: { message: "Tell AI what you want to advertise." } },
        { status: 400 },
      );
    }

    const creditCost = await getDynamicCreditCost("AI_VIDEO_SLIDESHOW");
    const isAdmin = !!session.adminId;
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_VIDEO_SLIDESHOW", isAdmin);
    if (creditCheck) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: creditCheck.code,
            message: creditCheck.message,
            required: creditCost,
          },
        },
        { status: creditCheck.code === "INSUFFICIENT_CREDITS" ? 402 : 403 },
      );
    }

    const job = await prisma.cartoonVideo.create({
      data: {
        userId: session.userId,
        storyPrompt: input.brief,
        style: input.style,
        animationType: "story_ad_movie",
        duration: input.duration,
        captionStyle: "cinematic",
        status: "PENDING",
        progress: 2,
        currentStep: "Starting your story ad movie...",
        creditsCost: creditCost,
        metadata: JSON.stringify({
          product: "story_ad_movie",
          aspectRatio: input.aspectRatio,
          duration: input.duration,
          style: input.style,
          goal: input.goal || null,
          destinationUrl: input.destinationUrl || null,
          chargedCredits: isAdmin ? 0 : creditCost,
        }),
      },
    });

    let creditsRemaining = session.user.aiCredits ?? 0;
    if (!isAdmin) {
      const charge = await creditService.deductCredits({
        userId: session.userId,
        type: TRANSACTION_TYPES.USAGE,
        amount: creditCost,
        referenceType: "story_ad_movie",
        referenceId: job.id,
        description: `AI story ad movie: ${input.brief.slice(0, 80)}`,
        metadata: {
          feature: "AI_VIDEO_SLIDESHOW",
          duration: input.duration,
          aspectRatio: input.aspectRatio,
        },
      });

      if (!charge.success) {
        await prisma.cartoonVideo.delete({ where: { id: job.id } });
        return NextResponse.json(
          { success: false, error: { message: charge.error || "Insufficient credits" } },
          { status: 402 },
        );
      }
      creditsRemaining = charge.transaction?.balanceAfter ?? creditsRemaining - creditCost;
    }

    processStoryAdMovie({
      jobId: job.id,
      userId: session.userId,
      brief: input.brief,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      style: input.style,
      goal: input.goal,
      destinationUrl: input.destinationUrl,
    }).catch((error) => {
      console.error("[StoryAdMovie] background processing failed:", error);
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining,
      },
    });
  } catch (error) {
    console.error("Story ad movie create error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to start story ad movie" } },
      { status: 500 },
    );
  }
}

// GET /api/ai/cartoon - List user's story ad movies
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const videos = await listCartoonVideos(session.userId, Math.min(limit, 50));

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({ videos }),
    });
  } catch (error) {
    console.error("Story ad movie list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch story ad movies" } },
      { status: 500 },
    );
  }
}
