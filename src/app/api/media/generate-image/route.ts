import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { uploadToS3 } from "@/lib/utils/s3-client";

// POST /api/media/generate-image — Generate an image with AI
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt } = body as { prompt: string };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Get dynamic credit cost for marketing image generation
    const creditCost = await getDynamicCreditCost("AI_MARKETING_IMAGE");

    // Check credits
    const balance = await creditService.getBalance(session.userId);
    if (balance < creditCost) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient credits. You need ${creditCost} credits but have ${balance}.`,
        },
        { status: 402 }
      );
    }

    // Try Flow AI first, then OpenAI DALL-E fallback
    let base64Image: string | null = null;

    // Flow AI (self-hosted Stable Diffusion)
    try {
      const { flowImageClient } = await import("@/lib/ai/flow-image-client");
      const isAvailable = await flowImageClient.isAvailable();
      if (isAvailable) {
        base64Image = await flowImageClient.generateImage(prompt, {
          width: 512,
          height: 512,
        });
      }
    } catch {
      // Flow AI not available, will try OpenAI
    }

    // OpenAI DALL-E fallback
    if (!base64Image && process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        });
        base64Image = response.data[0]?.b64_json || null;
      } catch (err) {
        console.error("OpenAI image generation failed:", err);
      }
    }

    if (!base64Image) {
      return NextResponse.json(
        { success: false, error: "Image generation failed. Neither Flow AI nor OpenAI is available." },
        { status: 503 }
      );
    }

    // Convert base64 to buffer and upload to S3
    const buffer = Buffer.from(base64Image, "base64");
    const key = `media/ai-gen-${session.userId}-${Date.now()}.png`;
    const url = await uploadToS3(key, buffer, "image/png");

    // Deduct credits
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `AI marketing image generation (${creditCost} credits)`,
      referenceType: "ai_marketing_image",
      referenceId: key,
    });

    return NextResponse.json({
      success: true,
      data: { url, creditCost },
    });
  } catch (error) {
    console.error("Generate image error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
