import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { estimateCampaignRenderCost, getCampaign } from "@/lib/story-ad-campaign";

/**
 * Returns the total credit cost the user will be charged to render the current
 * campaign in its current state — with provider/audio/SFX markup already baked in.
 *
 * Also returns the user's current balance + a `hasEnoughCredits` flag so the
 * Generate button can disable itself and trigger the credit-purchase modal
 * without an extra round-trip.
 */
export async function GET(
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

  const cost = estimateCampaignRenderCost(current.state);
  const isAdmin = !!session.adminId;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true, freeCredits: true },
  });
  const aiCredits = user?.aiCredits ?? 0;
  const freeCredits = user?.freeCredits ?? 0;
  // Story-ad-campaign is an AI feature — only purchased credits count.
  const usableCredits = Math.max(0, aiCredits - freeCredits);
  const hasEnoughCredits = isAdmin || usableCredits >= cost.total;

  return NextResponse.json({
    success: true,
    data: {
      total: cost.total,
      breakdown: {
        video: cost.videoCredits,
        images: cost.imageCredits,
        voice: cost.voiceCredits,
        soundEffects: cost.sfxCredits,
        music: cost.musicCredits,
        caption: cost.captionCredits,
      },
      qualityLabel: cost.qualityLabel,
      availableCredits: usableCredits,
      hasEnoughCredits,
      isAdmin,
    },
  });
}
