import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { getCartoonJobStatus, processCartoonVideoPhase1, processCartoonVideoPhase2, type CartoonCharacter, type CartoonScript } from "@/lib/cartoon";
import { generateCharacterPreview, generateSceneImage, type ImageProvider } from "@/lib/cartoon/image-generator";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { presignAllUrls } from "@/lib/utils/s3-client";

// GET /api/ai/cartoon/[id] - Get job status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const job = await getCartoonJobStatus(id, session.userId);

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Cartoon video not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: await presignAllUrls(job),
    });
  } catch (error) {
    console.error("Cartoon status error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to fetch cartoon status" } },
      { status: 500 }
    );
  }
}

// DELETE /api/ai/cartoon/[id] - Cancel/delete a cartoon job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find the job
    const job = await prisma.cartoonVideo.findFirst({
      where: { id, userId: session.userId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Cartoon video not found" } },
        { status: 404 }
      );
    }

    // Only allow deletion of completed or failed jobs
    if (!["COMPLETED", "FAILED"].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: { message: "Cannot delete a job that is still processing" } },
        { status: 400 }
      );
    }

    // Delete the job
    await prisma.cartoonVideo.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { message: "Cartoon video deleted" },
    });
  } catch (error) {
    console.error("Cartoon delete error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to delete cartoon video" } },
      { status: 500 }
    );
  }
}

// POST /api/ai/cartoon/[id] - Approve characters and continue processing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, characters } = body as {
      action: "approve" | "reject" | "retry";
      characters?: CartoonCharacter[];
    };

    // Find the job
    const job = await prisma.cartoonVideo.findFirst({
      where: { id, userId: session.userId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Cartoon video not found" } },
        { status: 404 }
      );
    }

    // Handle retry for failed jobs — resumes from saved progress
    if (action === "retry") {
      if (job.status !== "FAILED") {
        return NextResponse.json(
          { success: false, error: { message: `Can only retry failed jobs. Current status: ${job.status}` } },
          { status: 400 }
        );
      }

      // Re-charge credits (they were refunded on failure)
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true },
      });

      const isAdmin = !!session.adminId;
      if (!isAdmin && (!user || user.aiCredits < job.creditsCost)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INSUFFICIENT_CREDITS",
              message: `Retry requires ${job.creditsCost} credits. You have ${user?.aiCredits || 0} remaining.`,
            },
          },
          { status: 403 }
        );
      }

      // Deduct credits and reset status (keep existing script + sceneImages for resume)
      if (!isAdmin) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: session.userId },
            data: { aiCredits: { decrement: job.creditsCost } },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: session.userId,
              type: "USAGE",
              amount: -job.creditsCost,
              balanceAfter: (user?.aiCredits || 0) - job.creditsCost,
              referenceType: "ai_cartoon",
              referenceId: id,
              description: `Retry cartoon generation (resuming from saved progress)`,
            },
          }),
        ]);
      }

      // Reset status but keep saved data (script, sceneImages)
      await prisma.cartoonVideo.update({
        where: { id },
        data: {
          status: "PROCESSING",
          progress: 5,
          currentStep: "Resuming generation...",
          errorMessage: null,
        },
      });

      // Read imageProvider from metadata
      let jobImageProvider: ImageProvider = "openai";
      try {
        const meta = JSON.parse(job.metadata || "{}");
        if (meta.imageProvider === "sora") jobImageProvider = "sora" as ImageProvider;
        else if (meta.imageProvider === "flow") jobImageProvider = "flow";
        else if (meta.imageProvider === "canvas") jobImageProvider = "canvas";
      } catch {}

      // Fire-and-forget: resume processing (picks up saved script + images)
      processCartoonVideoPhase1({
        jobId: id,
        storyPrompt: job.storyPrompt,
        style: job.style,
        duration: job.duration,
        imageProvider: jobImageProvider,
      }).catch((err) => {
        console.error("Retry processing error:", err);
      });

      return NextResponse.json({
        success: true,
        data: {
          status: "retrying",
          message: "Resuming cartoon generation from saved progress...",
          creditsUsed: isAdmin ? 0 : job.creditsCost,
          creditsRemaining: isAdmin ? 999 : (user?.aiCredits || 0) - job.creditsCost,
        },
      });
    }

    // Only allow approval when awaiting
    if (job.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        { success: false, error: { message: `Cannot approve job with status: ${job.status}` } },
        { status: 400 }
      );
    }

    if (action === "reject") {
      // User rejected characters - mark as cancelled (no refund since AI work is already done)
      await prisma.cartoonVideo.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: "Cancelled by user during character review",
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          status: "cancelled",
          message: "Cartoon generation cancelled.",
        },
      });
    }

    // Approve characters - continue processing
    // Fire and forget - don't await
    processCartoonVideoPhase2(id, characters).catch((err) => {
      console.error("Phase 2 processing error:", err);
    });

    return NextResponse.json({
      success: true,
      data: {
        status: "approved",
        message: "Characters approved! Generating audio and animations...",
      },
    });
  } catch (error) {
    console.error("Cartoon approve error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to approve characters" } },
      { status: 500 }
    );
  }
}

// PATCH /api/ai/cartoon/[id] - Regenerate a character preview or scene background
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { characterName, character, sceneNumber } = body as {
      characterName?: string;
      character?: CartoonCharacter;
      sceneNumber?: number;
    };

    // Determine if this is a scene background or character regeneration
    if (sceneNumber != null) {
      return handleRegenerateSceneBackground(id, session.userId, sceneNumber);
    }

    if (!characterName) {
      return NextResponse.json(
        { success: false, error: { message: "Character name or scene number is required" } },
        { status: 400 }
      );
    }

    // Find the job
    const job = await prisma.cartoonVideo.findFirst({
      where: { id, userId: session.userId },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: { message: "Cartoon video not found" } },
        { status: 404 }
      );
    }

    // Only allow regeneration when awaiting approval
    if (job.status !== "AWAITING_APPROVAL") {
      return NextResponse.json(
        { success: false, error: { message: "Can only regenerate during approval phase" } },
        { status: 400 }
      );
    }

    // Get dynamic credit cost from admin hub
    const REGEN_CREDITS = await getDynamicCreditCost("AI_CARTOON_CHARACTER_REGEN");

    // Check user credits
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    if (!user || user.aiCredits < REGEN_CREDITS) {
      return NextResponse.json(
        { success: false, error: { message: `Insufficient credits. Need ${REGEN_CREDITS} credits.` } },
        { status: 403 }
      );
    }

    // Parse current script
    if (!job.script) {
      return NextResponse.json(
        { success: false, error: { message: "Script not found" } },
        { status: 400 }
      );
    }

    const script: CartoonScript = JSON.parse(job.script);
    const charIndex = script.characters.findIndex((c) => c.name === characterName);

    if (charIndex === -1) {
      return NextResponse.json(
        { success: false, error: { message: "Character not found in script" } },
        { status: 404 }
      );
    }

    // Use updated character data if provided, otherwise use existing
    const charToRegenerate = character || script.characters[charIndex];

    // Read imageProvider from job metadata or default to "openai"
    let jobImageProvider: ImageProvider = "openai";
    try {
      const meta = JSON.parse(job.metadata || "{}");
      if (meta.imageProvider === "sora") jobImageProvider = "openai"; // Sora is video-only; regen uses OpenAI images
      else if (meta.imageProvider === "flow") jobImageProvider = "flow";
      else if (meta.imageProvider === "canvas") jobImageProvider = "canvas";
    } catch {}

    // Generate new preview
    const newPreview = await generateCharacterPreview(charToRegenerate, job.style, id, jobImageProvider);

    // Update character in script with new preview
    script.characters[charIndex] = {
      ...charToRegenerate,
      previewUrl: newPreview.imageUrl,
    };

    // Deduct credits
    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.userId },
        data: { aiCredits: { decrement: REGEN_CREDITS } },
      }),
      prisma.creditTransaction.create({
        data: {
          userId: session.userId,
          type: "USAGE",
          amount: -REGEN_CREDITS,
          balanceAfter: user.aiCredits - REGEN_CREDITS,
          referenceType: "ai_cartoon_regen",
          referenceId: id,
          description: `Regenerate character preview: ${characterName}`,
        },
      }),
      prisma.cartoonVideo.update({
        where: { id },
        data: { script: JSON.stringify(script) },
      }),
      prisma.aIUsage.create({
        data: {
          userId: session.userId,
          feature: "cartoon_character_regen",
          model: "gpt-image-1",
          inputTokens: 0,
          outputTokens: 0,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: await presignAllUrls({
        character: script.characters[charIndex],
        creditsUsed: REGEN_CREDITS,
        creditsRemaining: user.aiCredits - REGEN_CREDITS,
      }),
    });
  } catch (error) {
    console.error("Regenerate error:", error);
    return NextResponse.json(
      { success: false, error: { message: "Failed to regenerate" } },
      { status: 500 }
    );
  }
}

/**
 * Handle scene background regeneration
 */
async function handleRegenerateSceneBackground(
  jobId: string,
  userId: string,
  sceneNumber: number
) {
  // Find the job
  const job = await prisma.cartoonVideo.findFirst({
    where: { id: jobId, userId },
  });

  if (!job) {
    return NextResponse.json(
      { success: false, error: { message: "Cartoon video not found" } },
      { status: 404 }
    );
  }

  if (job.status !== "AWAITING_APPROVAL") {
    return NextResponse.json(
      { success: false, error: { message: "Can only regenerate during approval phase" } },
      { status: 400 }
    );
  }

  const REGEN_CREDITS = await getDynamicCreditCost("AI_CARTOON_CHARACTER_REGEN");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiCredits: true },
  });

  if (!user || user.aiCredits < REGEN_CREDITS) {
    return NextResponse.json(
      { success: false, error: { message: `Insufficient credits. Need ${REGEN_CREDITS} credits.` } },
      { status: 403 }
    );
  }

  if (!job.script) {
    return NextResponse.json(
      { success: false, error: { message: "Script not found" } },
      { status: 400 }
    );
  }

  const script: CartoonScript = JSON.parse(job.script);
  const scene = script.scenes.find((s) => s.sceneNumber === sceneNumber);

  if (!scene) {
    return NextResponse.json(
      { success: false, error: { message: `Scene ${sceneNumber} not found` } },
      { status: 404 }
    );
  }

  // Parse existing scene images
  const sceneImages = job.sceneImages ? JSON.parse(job.sceneImages) : [];

  // Read imageProvider from job metadata or default to "openai"
  let jobImageProvider: ImageProvider = "openai";
  try {
    const meta = JSON.parse(job.metadata || "{}");
    if (meta.imageProvider === "sora") jobImageProvider = "openai"; // Sora is video-only; scene regen uses OpenAI images
    else if (meta.imageProvider === "flow") jobImageProvider = "flow";
    else if (meta.imageProvider === "canvas") jobImageProvider = "canvas";
  } catch {}

  // Generate new background image
  const newImage = await generateSceneImage(scene, job.style, jobId, script.characters, jobImageProvider);

  // Replace the image for this scene number
  const updatedImages = sceneImages.map((img: { sceneNumber: number; imageUrl: string }) =>
    img.sceneNumber === sceneNumber ? newImage : img
  );

  // If the scene didn't have an image before, add it
  if (!sceneImages.some((img: { sceneNumber: number }) => img.sceneNumber === sceneNumber)) {
    updatedImages.push(newImage);
  }

  // Deduct credits and update scene images
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { aiCredits: { decrement: REGEN_CREDITS } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: "USAGE",
        amount: -REGEN_CREDITS,
        balanceAfter: user.aiCredits - REGEN_CREDITS,
        referenceType: "ai_cartoon_regen",
        referenceId: jobId,
        description: `Regenerate scene ${sceneNumber} background`,
      },
    }),
    prisma.cartoonVideo.update({
      where: { id: jobId },
      data: { sceneImages: JSON.stringify(updatedImages) },
    }),
    prisma.aIUsage.create({
      data: {
        userId,
        feature: "cartoon_scene_regen",
        model: "gpt-image-1",
        inputTokens: 0,
        outputTokens: 0,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: await presignAllUrls({
      sceneImage: newImage,
      creditsUsed: REGEN_CREDITS,
      creditsRemaining: user.aiCredits - REGEN_CREDITS,
    }),
  });
}
