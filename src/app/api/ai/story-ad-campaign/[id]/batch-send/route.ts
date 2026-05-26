import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { checkCreditsAvailable } from "@/lib/credits/costs";
import {
  batchRenderCampaign,
  estimateCampaignRenderCost,
  getCampaign,
  updateCampaignState,
} from "@/lib/story-ad-campaign";

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

  if (!current.state.clips.length) {
    return NextResponse.json(
      { success: false, error: { message: "No clips to render. Plan the scene grid first." } },
      { status: 400 },
    );
  }

  const renderableClips = current.state.clips.filter((c) => c.status !== "READY");
  if (!renderableClips.length) {
    return NextResponse.json(
      { success: false, error: { message: "All clips are already rendered." } },
      { status: 400 },
    );
  }

  // Full cost across video + images + voice (narrator + dialogue) + SFX + caption.
  // Markup is baked into each cost key in DEFAULT_CREDIT_COSTS — this is the user-facing total.
  const cost = estimateCampaignRenderCost(current.state);
  const totalCost = cost.total;
  const isAdmin = !!session.adminId;

  // Use the unified credit guard — surfaces the same error shape (INSUFFICIENT_CREDITS / FREE_CREDITS_RESTRICTED)
  // the credit-purchase modal already understands.
  const block = await checkCreditsAvailable(session.userId, totalCost, false, isAdmin);
  if (block) {
    return NextResponse.json(
      { success: false, error: { code: block.code, message: block.message, required: block.cost } },
      { status: 402 },
    );
  }

  if (!isAdmin) {
    const charge = await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: totalCost,
      referenceType: "story_ad_campaign",
      referenceId: id,
      description: `Story ad campaign render (${current.state.style}, ${cost.qualityLabel})`,
      metadata: {
        feature: "story_ad_campaign",
        style: current.state.style,
        clipCount: renderableClips.length,
        clipLength: current.state.clipLength,
        provider: current.state.provider,
        breakdown: {
          video: cost.videoCredits,
          images: cost.imageCredits,
          voice: cost.voiceCredits,
          soundEffects: cost.sfxCredits,
          caption: cost.captionCredits,
        },
      },
    });
    if (!charge.success) {
      return NextResponse.json(
        { success: false, error: { message: charge.error || "Failed to deduct credits" } },
        { status: 402 },
      );
    }
  }

  await updateCampaignState(id, session.userId, { phase: "BATCH" });

  batchRenderCampaign({ campaignId: id, userId: session.userId }).catch((error) => {
    console.error("[StoryAdCampaign] batch render failed:", error);
  });

  return NextResponse.json({
    success: true,
    data: {
      creditsUsed: isAdmin ? 0 : totalCost,
      clipsQueued: renderableClips.length,
    },
  });
}
