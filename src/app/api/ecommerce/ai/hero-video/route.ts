import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { grokVideoClient } from "@/lib/ai/grok-video-client";

const bodySchema = z.object({
  storeName: z.string().min(1).max(200),
  industry: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const creditCheck = await checkCreditsForFeature(session.userId, "AI_VIDEO_STUDIO");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input" } },
        { status: 400 }
      );
    }

    const { storeName, industry } = parsed.data;

    const prompt = `A professional, cinematic promotional video for an e-commerce store called "${storeName}" in the ${industry} industry. Smooth camera movement, premium product showcase, modern brand aesthetic, warm professional lighting. Clean, aspirational, suitable for a hero banner. No text overlays.`;

    let videoBuffer: Buffer | null = null;
    try {
      if (grokVideoClient.isAvailable()) {
        const result = await grokVideoClient.generateVideo(prompt, {
          duration: 8,
          aspectRatio: "16:9",
          resolution: "720p",
          timeoutMs: 900000,
        });
        videoBuffer = result.videoBuffer;
      }
    } catch (error) {
      console.warn("[HeroVideo] xAI video generation failed, using Sora fallback:", error);
    }

    if (!videoBuffer) {
      const { soraClient } = await import("@/lib/ai/sora-client");
      const result = await soraClient.generateVideoBuffer(prompt, {
        seconds: "8",
        size: "1280x720",
      });
      videoBuffer = result.videoBuffer;
    }

    if (!videoBuffer) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate hero video" } },
        { status: 500 }
      );
    }

    // Upload to S3
    const { uploadToS3 } = await import("@/lib/utils/s3-client");
    const { randomUUID } = await import("crypto");

    const key = `stores/hero-videos/${randomUUID()}.mp4`;
    const videoUrl = await uploadToS3(key, videoBuffer, "video/mp4");

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_VIDEO_STUDIO");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: `Hero video generation: ${storeName}`,
      referenceType: "hero_video",
    });

    return NextResponse.json({
      success: true,
      data: { videoUrl },
    });
  } catch (error) {
    console.error("Hero video generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate hero video" } },
      { status: 500 }
    );
  }
}
