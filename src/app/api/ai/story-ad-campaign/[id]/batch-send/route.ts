import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import {
  batchRenderCampaign,
  creditsPerClip,
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

  const perClip = creditsPerClip(current.state.clipLength);
  const totalCost = perClip * renderableClips.length;

  const isAdmin = !!session.adminId;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true },
  });
  if (!isAdmin && (!user || user.aiCredits < totalCost)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `Batch needs ${totalCost} credits. You have ${user?.aiCredits || 0}.`,
          required: totalCost,
          available: user?.aiCredits || 0,
        },
      },
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
      description: `Story ad campaign batch — ${renderableClips.length} clips via ${current.state.provider}`,
      metadata: {
        feature: "story_ad_campaign",
        clipCount: renderableClips.length,
        clipLength: current.state.clipLength,
        provider: current.state.provider,
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
