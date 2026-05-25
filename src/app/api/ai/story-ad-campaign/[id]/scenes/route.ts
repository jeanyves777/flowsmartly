import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  getBrandSnapshot,
  getCampaign,
  planSceneGrid,
  refundStoryAdCampaignUsage,
  updateCampaignState,
} from "@/lib/story-ad-campaign";
import { DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";

export async function POST(
  _request: NextRequest,
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
  if (!current.state.characters.length) {
    return NextResponse.json(
      { success: false, error: { message: "Build the character catalog first." } },
      { status: 400 },
    );
  }

  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_STORY_CAMPAIGN_SCENES",
    campaignId: id,
    description: "Story Ad Campaign: scene grid screenplay",
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
    const clips = await planSceneGrid(current.state, brand);
    const merged = await updateCampaignState(id, session.userId, {
      clips,
      phase: "PROMPTS",
    });
    return NextResponse.json({ success: true, data: { state: merged, creditsRemaining: charge.remaining } });
  } catch (error) {
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_SCENES,
        campaignId: id,
        reason: "Refund: scene grid generation failed",
      });
    }
    const message = error instanceof Error ? error.message : "Failed to plan scene grid";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
