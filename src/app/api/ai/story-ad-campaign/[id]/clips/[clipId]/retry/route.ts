import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { creditService, TRANSACTION_TYPES } from "@/lib/credits";
import { creditsPerClip, getCampaign, retrySingleClip } from "@/lib/story-ad-campaign";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; clipId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id, clipId } = await params;
  const body = (await request.json().catch(() => ({}))) as { lengthSec?: number };
  const lengthSec =
    typeof body.lengthSec === "number" && body.lengthSec > 8 ? Math.min(15, Math.round(body.lengthSec)) : undefined;

  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  const clip = current.state.clips.find((c) => c.id === clipId);
  if (!clip) {
    return NextResponse.json({ success: false, error: { message: "Clip not found" } }, { status: 404 });
  }

  // Charge credits per retry (same as a normal clip render). The brand OUTRO
  // scene renders locally (ffmpeg) with no provider cost, so it's always free.
  const isAdmin = !!session.adminId;
  const isOutro = clip.isOutro === true;
  const cost = creditsPerClip(current.state.clipLength);

  if (!isAdmin && !isOutro) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { aiCredits: true },
    });
    if (!user || user.aiCredits < cost) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_CREDITS",
            message: `Retry needs ${cost} credits. You have ${user?.aiCredits || 0}.`,
            required: cost,
            available: user?.aiCredits || 0,
          },
        },
        { status: 402 },
      );
    }
    const charge = await creditService.deductCredits({
      userId: session.userId,
      type: TRANSACTION_TYPES.USAGE,
      amount: cost,
      referenceType: "story_ad_campaign_retry",
      referenceId: id,
      description: `Retry clip ${clip.index} via ${current.state.provider}`,
      metadata: { feature: "story_ad_campaign", clipIndex: clip.index, provider: current.state.provider },
    });
    if (!charge.success) {
      return NextResponse.json(
        { success: false, error: { message: charge.error || "Failed to deduct credits" } },
        { status: 402 },
      );
    }
  }

  try {
    const result = await retrySingleClip({ campaignId: id, userId: session.userId, clipId, lengthSec });

    // Refund if the retry itself failed (outro was never charged → never refunded)
    if (result.status === "FAILED" && !isAdmin && !isOutro) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { aiCredits: true },
      });
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: session.userId },
          data: { aiCredits: { increment: cost } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: session.userId,
            type: TRANSACTION_TYPES.REFUND,
            amount: cost,
            balanceAfter: (user?.aiCredits || 0) + cost,
            referenceType: "story_ad_campaign_retry",
            referenceId: id,
            description: `Refund for failed retry of clip ${clip.index}`,
          },
        });
      });
    }

    return NextResponse.json({ success: true, data: { result } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
