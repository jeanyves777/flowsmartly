import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { z } from "zod";
import { generateStoreContent } from "@/lib/ai/generators/store-content";
import { checkCreditsForFeature, getDynamicCreditCost } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import type { BrandContext } from "@/lib/ai/types";

const requestSchema = z.object({
  contentTypes: z
    .array(z.enum(["tagline", "about", "hero", "return_policy", "shipping_policy", "terms_of_service", "privacy_policy", "faq"]))
    .min(1),
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
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_STORE_CONTENT");
    if (creditCheck) {
      return NextResponse.json(
        { success: false, error: { code: creditCheck.code, message: creditCheck.message } },
        { status: 402 }
      );
    }

    // Get user's store for context
    const store = await prisma.store.findUnique({
      where: { userId: session.userId },
      select: { name: true, industry: true },
    });

    // Get brand context
    let brandContext: BrandContext | undefined;
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId, isDefault: true },
    });
    if (!brandKit) {
      const anyBrandKit = await prisma.brandKit.findFirst({
        where: { userId: session.userId },
      });
      if (anyBrandKit) {
        brandContext = parseBrandKit(anyBrandKit);
      }
    } else {
      brandContext = parseBrandKit(brandKit);
    }

    // Generate content
    const result = await generateStoreContent({
      contentTypes: parsed.data.contentTypes,
      storeName: store?.name,
      industry: store?.industry || undefined,
      brandContext,
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: "GENERATION_FAILED", message: "Failed to generate store content" } },
        { status: 500 }
      );
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_STORE_CONTENT");
    await creditService.deductCredits({
      userId: session.userId,
      amount: cost,
      type: TRANSACTION_TYPES.USAGE,
      description: "AI store content generation",
      referenceType: "store",
    });

    return NextResponse.json({
      success: true,
      data: { ...result, creditsUsed: cost },
    });
  } catch (error) {
    console.error("Store content generation error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate store content" } },
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
