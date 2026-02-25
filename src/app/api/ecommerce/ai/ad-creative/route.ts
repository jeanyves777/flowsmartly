import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost, checkCreditsForFeature } from "@/lib/credits/costs";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { generateAdCreatives, getAdCreatives } from "@/lib/ads/ad-creative-generator";

// GET — fetch existing creative variants for a product
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const productId = request.nextUrl.searchParams.get("productId");
    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Verify product belongs to user
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { userId: session.userId } },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const variants = await getAdCreatives(productId);
    return NextResponse.json({ variants });
  } catch (error) {
    console.error("Get ad creatives error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — generate new AI ad creative variants
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, platforms } = body;

    if (!productId) {
      return NextResponse.json({ error: "productId is required" }, { status: 400 });
    }

    // Verify product belongs to user
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { userId: session.userId } },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Credit check
    const creditCheck = await checkCreditsForFeature(session.userId, "AI_AD_CREATIVE");
    if (creditCheck) {
      return NextResponse.json(
        { error: creditCheck.message, code: creditCheck.code },
        { status: 402 }
      );
    }

    // Deduct credits
    const cost = await getDynamicCreditCost("AI_AD_CREATIVE");
    await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: cost,
      description: `AI ad creative generation (${cost} credits)`,
      referenceType: "ai_ad_creative",
    });

    // Generate creatives
    const validPlatforms = (platforms || ["google", "facebook", "tiktok", "flowsmartly"]).filter(
      (p: string) => ["google", "facebook", "tiktok", "flowsmartly"].includes(p)
    );

    const variants = await generateAdCreatives(productId, validPlatforms);

    return NextResponse.json({ variants });
  } catch (error) {
    console.error("Generate ad creatives error:", error);
    return NextResponse.json({ error: "Failed to generate ad creatives" }, { status: 500 });
  }
}
