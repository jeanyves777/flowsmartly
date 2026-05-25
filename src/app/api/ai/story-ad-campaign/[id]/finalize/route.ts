import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  finalizeCampaign,
  getCampaign,
  refundStoryAdCampaignUsage,
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
  const readyCount = current.state.clips.filter((c) => c.status === "READY" && c.videoUrl).length;
  if (readyCount === 0) {
    return NextResponse.json(
      { success: false, error: { message: "Render the clips first." } },
      { status: 400 },
    );
  }

  // Charge for the AI caption that gets regenerated as part of finalize
  // (ffmpeg concat + logo overlay are local — no provider cost).
  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_STORY_CAMPAIGN_CAPTION",
    campaignId: id,
    description: "Story Ad Campaign: stitch reel + caption regen",
  });
  if (!charge.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `Stitching costs ${charge.required} credits. You have ${charge.available} remaining.`,
          required: charge.required,
          available: charge.available,
        },
      },
      { status: 402 },
    );
  }

  try {
    const result = await finalizeCampaign({ campaignId: id, userId: session.userId });
    return NextResponse.json({
      success: true,
      data: { finalVideoUrl: result.finalVideoUrl, creditsRemaining: charge.remaining },
    });
  } catch (error) {
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_CAPTION,
        campaignId: id,
        reason: "Refund: stitch reel failed",
      });
    }
    const message = error instanceof Error ? error.message : "Finalize failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
