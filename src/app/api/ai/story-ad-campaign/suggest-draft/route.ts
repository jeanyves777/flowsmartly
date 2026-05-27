import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";
import {
  getBrandSnapshot,
  refundStoryAdCampaignUsage,
  suggestDraftField,
} from "@/lib/story-ad-campaign";

/**
 * Stage 0 "give me an idea" suggester for Brief + Goal fields. Doesn't require a campaign
 * row yet — pulls the user's BrandKit, generates a fresh suggestion, returns it.
 *
 * Costs the same as a per-field suggest (AI_STORY_CAMPAIGN_SUGGEST = 3 credits). Each call
 * uses a random seed so successive presses don't return the same idea.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    field?: "brief" | "goal";
    currentValue?: string;
    hint?: string;
  };
  const field = body.field;
  if (field !== "brief" && field !== "goal") {
    return NextResponse.json(
      { success: false, error: { message: "field must be 'brief' or 'goal'." } },
      { status: 400 },
    );
  }

  const isAdmin = !!session.adminId;
  if (!isAdmin) {
    const charge = await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_SUGGEST,
      referenceType: "story_ad_campaign_draft_suggest",
      referenceId: field,
      description: `Story Ad Campaign: draft suggest (${field})`,
      metadata: { field },
    });
    if (!charge.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: charge.error || `This requires ${DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_SUGGEST} credits.`,
          },
        },
        { status: 402 },
      );
    }
  }

  try {
    const brand = await getBrandSnapshot(session.userId);
    const value = await suggestDraftField({
      field,
      brand,
      currentValue: body.currentValue,
      hint: body.hint,
    });
    return NextResponse.json({ success: true, data: { value } });
  } catch (error) {
    // Refund on failure so the user isn't charged for a broken suggestion.
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_SUGGEST,
        campaignId: `draft-${field}`,
        reason: "Refund: draft suggest failed",
      }).catch(() => { /* best-effort */ });
    }
    const message = error instanceof Error ? error.message : "Suggestion failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
