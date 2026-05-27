import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { estimateCampaignRenderCost } from "@/lib/story-ad-campaign";
import {
  emptyCampaignState,
  type CampaignAspectRatio,
  type CampaignClipLength,
  type CampaignDurationSeconds,
  type CampaignProvider,
  type CampaignStyle,
} from "@/lib/story-ad-campaign/types";

/**
 * Estimate the render cost for a campaign that doesn't exist yet (Stage 0 of the
 * creator flow). Lets users see the full credit cost upfront — before committing
 * to creating the campaign row.
 *
 * Takes only the fields the user has actually set at Stage 0 (style, duration,
 * aspect, provider, clipLength) and runs the same calculator the post-creation
 * /[id]/estimate-cost endpoint uses, so the preview never diverges from the gate.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    style?: CampaignStyle;
    durationSeconds?: CampaignDurationSeconds;
    aspectRatio?: CampaignAspectRatio;
    provider?: CampaignProvider;
    clipLength?: CampaignClipLength;
    narratedSubStyle?: "3d" | "cinematic";
    fullAnimation?: boolean;
    batchMode?: boolean;
  };

  // Build a synthetic state from defaults + the bits the user actually picked.
  // The calculator only needs style/duration/provider/clipLength/narratedSubStyle and
  // gracefully handles empty clips by assuming a typical campaign shape.
  const base = emptyCampaignState();
  const state = {
    ...base,
    style: body.style ?? base.style,
    durationSeconds: body.durationSeconds ?? base.durationSeconds,
    aspectRatio: body.aspectRatio ?? base.aspectRatio,
    provider: body.provider ?? base.provider,
    clipLength: body.clipLength ?? base.clipLength,
    narratedSubStyle: body.narratedSubStyle,
    fullAnimation: body.fullAnimation === true,
    batchMode: body.batchMode === true,
  };

  // Style is required for a meaningful estimate; without it the calculator returns
  // a useless number. Fail fast with a clear error so the UI can wait until Stage 1.
  if (!state.style) {
    return NextResponse.json(
      { success: false, error: { message: "Pick a campaign style before estimating cost." } },
      { status: 400 },
    );
  }

  const cost = estimateCampaignRenderCost(state);
  const isAdmin = !!session.adminId;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { aiCredits: true, freeCredits: true },
  });
  const aiCredits = user?.aiCredits ?? 0;
  const freeCredits = user?.freeCredits ?? 0;
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
