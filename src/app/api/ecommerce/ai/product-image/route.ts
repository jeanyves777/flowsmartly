import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { openaiClient } from "@/lib/ai/openai-client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { randomUUID } from "crypto";

const bodySchema = z.object({
  productName: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  style: z.enum(["lifestyle", "studio", "flat_lay"]).optional().default("studio"),
});

const STYLE_INSTRUCTIONS: Record<string, string> = {
  lifestyle:
    "Product shown in real-life context, lifestyle setting, warm lighting, natural environment",
  studio:
    "Product on clean white background, professional studio lighting, e-commerce ready, sharp details",
  flat_lay:
    "Top-down flat lay arrangement, styled props, aesthetic composition, organized layout",
};

// ── POST /api/ecommerce/ai/product-image ──

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors.map((e) => e.message).join(", "),
          },
        },
        { status: 400 }
      );
    }

    const { productName, description, style } = parsed.data;

    // Credit check
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_PRODUCT_IMAGE");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    // Build prompt
    const styleInstructions = STYLE_INSTRUCTIONS[style];
    const descPart = description ? ` ${description}.` : "";
    const prompt = `Professional e-commerce product photo of ${productName}.${descPart} ${styleInstructions}. High quality, clean composition, studio lighting, photorealistic.`;

    // Generate image
    const base64 = await openaiClient.generateImage(prompt, {
      size: "1024x1024",
      quality: "high",
    });

    if (!base64) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate product image" } },
        { status: 500 }
      );
    }

    // Upload to S3
    const buffer = Buffer.from(base64, "base64");
    const key = `products/ai-generated/${randomUUID()}.png`;
    const imageUrl = await uploadToS3(key, buffer, "image/png");

    // Deduct credits
    const creditCost = await getDynamicCreditCost("AI_PRODUCT_IMAGE");
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: creditCost,
      description: `AI product image generation: ${productName} (${style})`,
      referenceType: "ai_product_image",
    });

    return NextResponse.json({
      success: true,
      data: { imageUrl },
    });
  } catch (error) {
    console.error("AI product image generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate product image" } },
      { status: 500 }
    );
  }
}
