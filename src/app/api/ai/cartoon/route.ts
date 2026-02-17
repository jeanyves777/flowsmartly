import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { checkPlanAccess } from "@/lib/auth/plan-gate";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { processCartoonVideo, listCartoonVideos } from "@/lib/cartoon";
import { presignAllUrls } from "@/lib/utils/s3-client";

// POST /api/ai/cartoon - Create a new cartoon video job
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const gate = checkPlanAccess(session.user.plan, "AI cartoon video");
    if (gate) return gate;

    // Get dynamic credit cost from database
    const BASE_CREDITS = await getDynamicCreditCost("AI_CARTOON_VIDEO");
    const ANIMATION_EXTRA_CREDITS = 100; // Extra credits for character animation

    const body = await request.json();
    const { storyPrompt, style = "anime", animationType = "static", duration = 60, captionStyle = "classic", projectId, existingCharacters, selectedLibraryCharacters } = body;
    const imageProvider: "openai" | "flow" | "canvas" | "sora" = (body.imageProvider === "sora") ? "sora" : (body.imageProvider === "flow") ? "flow" : (body.imageProvider === "canvas") ? "canvas" : "openai";

    // Validate input
    if (!storyPrompt || storyPrompt.trim().length < 10) {
      return NextResponse.json(
        { success: false, error: { message: "Story prompt must be at least 10 characters" } },
        { status: 400 }
      );
    }

    const validStyles = ["anime", "comic", "watercolor", "cartoon2d", "flatdesign", "pixar", "clay", "lowpoly"];
    if (!validStyles.includes(style)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid style. Choose from: ${validStyles.join(", ")}` } },
        { status: 400 }
      );
    }

    const validAnimationTypes = ["static", "animated"];
    if (!validAnimationTypes.includes(animationType)) {
      return NextResponse.json(
        { success: false, error: { message: "Invalid animation type. Choose: static or animated" } },
        { status: 400 }
      );
    }

    if (![30, 60, 90].includes(duration)) {
      return NextResponse.json(
        { success: false, error: { message: "Duration must be 30, 60, or 90 seconds" } },
        { status: 400 }
      );
    }

    const validCaptionStyles = ["none", "classic", "bold_pop", "boxed", "cinematic", "colorful"];
    if (!validCaptionStyles.includes(captionStyle)) {
      return NextResponse.json(
        { success: false, error: { message: `Invalid caption style. Choose from: ${validCaptionStyles.join(", ")}` } },
        { status: 400 }
      );
    }

    // Calculate total credits (canvas backgrounds = free, no image generation cost)
    const providerMultiplier = imageProvider === "sora" ? 1.5 : imageProvider === "canvas" ? 0.3 : imageProvider === "flow" ? 0.5 : 1;
    const totalCredits = Math.round(BASE_CREDITS * providerMultiplier) + (animationType === "animated" ? ANIMATION_EXTRA_CREDITS : 0);

    // Check credits (free credits can only be used for email marketing)
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true, freeCredits: true },
    });

    const isAdmin = !!session.adminId;
    const purchasedCredits = Math.max(0, (user?.aiCredits || 0) - (user?.freeCredits || 0));

    if (!isAdmin && (!user || purchasedCredits < totalCredits)) {
      const isFreeRestricted = user && (user.freeCredits || 0) > 0 && user.aiCredits >= totalCredits && purchasedCredits < totalCredits;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: isFreeRestricted ? "FREE_CREDITS_RESTRICTED" : "INSUFFICIENT_CREDITS",
            message: isFreeRestricted
              ? `Your free credits can only be used for email marketing. Purchase credits to use this feature (${totalCredits} credits required).`
              : `Cartoon generation requires ${totalCredits} credits. You have ${purchasedCredits} purchased credits remaining.`,
          },
        },
        { status: 403 }
      );
    }

    // Create job record
    const job = await prisma.cartoonVideo.create({
      data: {
        userId: session.userId,
        projectId: projectId || null,
        storyPrompt: storyPrompt.trim(),
        style,
        animationType,
        duration,
        captionStyle,
        status: "PENDING",
        progress: 0,
        creditsCost: totalCredits,
        metadata: JSON.stringify({ imageProvider }),
      },
    });

    // Deduct credits upfront (will be refunded on failure)
    if (!isAdmin) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: session.userId },
          data: { aiCredits: { decrement: totalCredits } },
        }),
        prisma.creditTransaction.create({
          data: {
            userId: session.userId,
            type: "USAGE",
            amount: -totalCredits,
            balanceAfter: (user?.aiCredits || 0) - totalCredits,
            referenceType: "ai_cartoon",
            referenceId: job.id,
            description: `Cartoon video generation: ${style} style, ${duration}s${animationType === "animated" ? " (with animation)" : ""}`,
          },
        }),
      ]);
    }

    // Track AI usage
    await prisma.aIUsage.create({
      data: {
        userId: isAdmin ? null : session.userId,
        adminId: isAdmin ? session.adminId : null,
        feature: "cartoon_video",
        model: "claude-sonnet-4+gpt-image-1+tts-1",
        inputTokens: 0,
        outputTokens: 0,
      },
    });

    // Fire-and-forget: Start processing in background
    processCartoonVideo({
      jobId: job.id,
      storyPrompt: storyPrompt.trim(),
      style,
      duration,
      existingCharacters,
      imageProvider,
      selectedLibraryCharacters,
    }).catch((err) => {
      console.error("Cartoon processing failed:", err);
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: "PENDING",
        creditsUsed: isAdmin ? 0 : totalCredits,
        creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - totalCredits,
      },
    });
  } catch (error) {
    console.error("Cartoon creation error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to create cartoon job" } },
      { status: 500 }
    );
  }
}

// GET /api/ai/cartoon - List user's cartoon videos
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
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
    console.error("Cartoon list error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch cartoon videos" } },
      { status: 500 }
    );
  }
}
