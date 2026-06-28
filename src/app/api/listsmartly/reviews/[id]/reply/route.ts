import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import { draftReviewResponse } from "@/lib/listsmartly/ai-review-responder";

/**
 * POST /api/listsmartly/reviews/[id]/reply
 *
 * One-shot reply to a customer review for the new-design Reviews surface.
 * Two modes, chosen by the body:
 *   • { mode: "draft" }          → AI-draft a reply, save it as aiDraftResponse,
 *                                  set responseStatus="ai_drafted" (charges
 *                                  AI_REVIEW_RESPONSE credits). Returns the draft
 *                                  so the user can edit before posting.
 *   • { mode: "post", text }     → record the (edited) reply as posted:
 *                                  responseStatus="posted", postedResponse=text,
 *                                  respondedAt=now. Free — recording a reply the
 *                                  user pasted onto the platform is not AI work.
 *   • { mode: "auto", post:true } → draft AND post in one call (charges the draft
 *                                  cost). Used by the agent's respond_to_review.
 *
 * Mirrors the existing /ai/review-response (draft) + PUT /reviews/[id] (post)
 * flow, but in a single endpoint so the surface's "AI-draft + post" is clean.
 */
export async function POST(
  req: NextRequest,
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
    const body = await req.json().catch(() => ({}));
    const mode: string = typeof body.mode === "string" ? body.mode : "draft";
    const providedText: string | undefined =
      typeof body.text === "string" ? body.text.trim() : undefined;

    const profile = await prisma.listSmartlyProfile.findUnique({
      where: { userId: session.userId },
    });
    if (!profile) {
      return NextResponse.json(
        { success: false, error: { message: "ListSmartly profile not found" } },
        { status: 404 }
      );
    }

    const review = await prisma.listingReview.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!review) {
      return NextResponse.json(
        { success: false, error: { message: "Review not found" } },
        { status: 404 }
      );
    }

    // ---- POST mode: record an edited reply the user already wrote. Free. ----
    if (mode === "post") {
      const text = providedText || review.aiDraftResponse || "";
      if (!text) {
        return NextResponse.json(
          { success: false, error: { message: "No reply text to post." } },
          { status: 400 }
        );
      }
      const updated = await prisma.listingReview.update({
        where: { id: review.id },
        data: {
          postedResponse: text,
          responseStatus: "posted",
          respondedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        data: {
          review: { ...updated, keywords: JSON.parse(updated.keywords) },
          posted: true,
          response: text,
        },
      });
    }

    // ---- DRAFT / AUTO modes: generate a reply with AI (charges credits). ----
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

    const brandKit = await prisma.brandKit.findFirst({
      where: { userId: session.userId },
      select: { name: true, voiceTone: true, personality: true },
    });
    let personalityStr: string | undefined;
    if (brandKit?.personality) {
      try {
        personalityStr = (JSON.parse(brandKit.personality) as string[]).join(", ");
      } catch {
        personalityStr = brandKit.personality;
      }
    }

    const result = await draftReviewResponse(
      { text: review.text, rating: review.rating, authorName: review.authorName },
      {
        businessName: profile.businessName,
        voiceTone: brandKit?.voiceTone || undefined,
        personality: personalityStr,
        industry: profile.industry || undefined,
      }
    );

    // In auto mode, post immediately; otherwise leave as an editable draft.
    const shouldPost = mode === "auto" && body.post !== false;
    const updated = await prisma.listingReview.update({
      where: { id: review.id },
      data: shouldPost
        ? {
            aiDraftResponse: result.response,
            postedResponse: result.response,
            responseStatus: "posted",
            respondedAt: new Date(),
          }
        : {
            aiDraftResponse: result.response,
            responseStatus: "ai_drafted",
          },
    });

    // Deduct credits + log (drafting is the AI work that costs).
    if (!isAdmin && creditCost > 0) {
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
          description: `AI review reply (${review.platform})`,
          referenceType: "ai_review_response",
          referenceId: review.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        review: { ...updated, keywords: JSON.parse(updated.keywords) },
        response: result.response,
        tone: result.tone,
        posted: shouldPost,
        creditsUsed: isAdmin ? 0 : creditCost,
        creditsRemaining: isAdmin ? (user?.aiCredits || 0) : (user?.aiCredits || 0) - creditCost,
      },
    });
  } catch (error) {
    console.error("[ListSmartly] Review reply error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { message: error instanceof Error ? error.message : "Failed to reply to review" },
      },
      { status: 500 }
    );
  }
}
