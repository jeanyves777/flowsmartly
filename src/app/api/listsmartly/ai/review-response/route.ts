import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { draftReviewResponse } from "@/lib/listsmartly/ai-review-responder";

/**
 * POST /api/listsmartly/ai/review-response
 * Generate an AI-drafted response to a customer review.
 *
 * Body: { reviewId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { reviewId } = body;

    if (!reviewId) {
      return NextResponse.json(
        { success: false, error: { message: "reviewId is required" } },
        { status: 400 }
      );
    }

    // Fetch profile
    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    // Fetch review
    const review = await prisma.listingReview.findFirst({
      where: { id: reviewId, profileId: profile.id },
    });
    if (!review) {
      return NextResponse.json(
        { success: false, error: { message: "Review not found" } },
        { status: 404 }
      );
    }

    // Check credits
    const creditCost = await getDynamicCreditCost("AI_REVIEW_RESPONSE");
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });

    const isAdmin = !!session.adminId;
    if (!isAdmin && (!user || user.aiCredits < creditCost)) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Insufficient credits" },
          required: creditCost,
          available: user?.aiCredits || 0,
        },
        { status: 402 }
      );
    }

    // Optionally load brand kit for voice/tone
    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: { name: true, voiceTone: true, personality: true },
    });

    // Parse personality JSON array into a readable string
    let personalityStr: string | undefined;
    if (brandKit?.personality) {
      try {
        const traits: string[] = JSON.parse(brandKit.personality);
        personalityStr = traits.join(", ");
      } catch {
        personalityStr = brandKit.personality;
      }
    }

    // Generate response
    const result = await draftReviewResponse(
      {
        text: review.text,
        rating: review.rating,
        authorName: review.authorName,
      },
      {
        businessName: profile.businessName,
        voiceTone: brandKit?.voiceTone || undefined,
        personality: personalityStr,
        industry: profile.industry || undefined,
      }
    );

    // Update review
    await prisma.listingReview.update({
      where: { id: review.id },
      data: {
        aiDraftResponse: result.response,
        responseStatus: "ai_drafted",
      },
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
          description: `AI review response draft (${review.platform})`,
          referenceType: "ai_review_response",
          referenceId: review.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        tone: result.tone,
        reviewId: review.id,
        creditsUsed: creditCost,
        creditsRemaining: (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[ListSmartly] AI review response error:", error);
    return NextResponse.json(
      { success: false, error: { message: error instanceof Error ? error.message : "Failed to generate review response" } },
      { status: 500 }
    );
  }
}
