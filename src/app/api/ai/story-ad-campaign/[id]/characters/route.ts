import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  getBrandSnapshot,
  getCampaign,
  planCharacterCatalog,
  refundStoryAdCampaignUsage,
  updateCampaignState,
} from "@/lib/story-ad-campaign";
import { DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  if (!current.state.style) {
    return NextResponse.json(
      { success: false, error: { message: "Choose a campaign style first." } },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = Math.max(1, Math.min(6, Number(body.count) || 3));

  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_STORY_CAMPAIGN_CATALOG",
    campaignId: id,
    description: "Story Ad Campaign: character catalog + outline",
  });
  if (!charge.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `This requires ${charge.required} credits. You have ${charge.available} remaining.`,
          required: charge.required,
          available: charge.available,
        },
      },
      { status: 402 },
    );
  }

  try {
    const brand = await getBrandSnapshot(session.userId);
    const plan = await planCharacterCatalog(current.state, brand, count);
    const merged = await updateCampaignState(id, session.userId, {
      characters: plan.characters,
      storyOutline: plan.storyOutline,
      phase: "CHARACTERS",
    });
    return NextResponse.json({ success: true, data: { state: merged, creditsRemaining: charge.remaining } });
  } catch (error) {
    // Refund on failure
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_CATALOG,
        campaignId: id,
        reason: "Refund: character catalog generation failed",
      });
    }
    const message = error instanceof Error ? error.message : "Failed to plan character catalog";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
