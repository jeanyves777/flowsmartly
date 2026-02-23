import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { generateProductCopy } from "@/lib/ai/generators/product-copy";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import type { BrandContext } from "@/lib/ai/types";

const requestSchema = z.object({
  productName: z.string().min(1).max(200),
  category: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  existingDescription: z.string().optional(),
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

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message || "Invalid input" } },
        { status: 400 }
      );
    }

    // Credit check
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_PRODUCT_COPY");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    // Get brand context
    let brandContext: BrandContext | undefined;
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      // Try any brandKit
      const anyBrandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
      if (anyBrandKit) {
        brandContext = parseBrandKit(anyBrandKit);
      }
    } else {
      brandContext = parseBrandKit(brandKit);
    }

    // Generate copy
    const result = await generateProductCopy({
      ...parsed.data,
      brandContext,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate product copy" } },
        { status: 500 }
      );
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_PRODUCT_COPY");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: "AI product copy generation",
      referenceType: "product",
    });

    return NextResponse.json({
      success: true,
      data: { ...result, creditsUsed: cost },
    });
  } catch (error) {
    console.error("Product copy generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate product copy" } },
      { status: 500 }
    );
  }
}

function parseBrandKit(kit: any): BrandContext {
  return {
    name: kit.name,
    tagline: kit.tagline || undefined,
    description: kit.description || undefined,
    industry: kit.industry || undefined,
    niche: kit.niche || undefined,
    targetAudience: kit.targetAudience || undefined,
    audienceAge: kit.audienceAge || undefined,
    audienceLocation: kit.audienceLocation || undefined,
    voiceTone: kit.voiceTone || undefined,
    personality: safeJsonParse(kit.personality, []),
    keywords: safeJsonParse(kit.keywords, []),
    avoidWords: safeJsonParse(kit.avoidWords, []),
    hashtags: safeJsonParse(kit.hashtags, []),
    products: safeJsonParse(kit.products, []),
    uniqueValue: kit.uniqueValue || undefined,
    email: kit.email || undefined,
    phone: kit.phone || undefined,
    website: kit.website || undefined,
    address: kit.address || undefined,
  };
}

function safeJsonParse(value: string | null | undefined, fallback: any): any {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
