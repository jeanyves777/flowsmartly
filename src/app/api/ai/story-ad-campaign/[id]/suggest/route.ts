import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  getBrandSnapshot,
  getCampaign,
  refundStoryAdCampaignUsage,
  suggestField,
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

  const body = (await request.json().catch(() => ({}))) as {
    field?: string;
    characterId?: string;
    clipId?: string;
    hint?: string;
  };

  if (!body.field) {
    return NextResponse.json(
      { success: false, error: { message: "Field name is required." } },
      { status: 400 },
    );
  }

  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_STORY_CAMPAIGN_SUGGEST",
    campaignId: id,
    description: `Story Ad Campaign suggest: ${body.field}`,
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
    const value = await suggestField({
      field: body.field,
      state: current.state,
      brand,
      characterId: body.characterId || null,
      clipId: body.clipId || null,
      hint: body.hint || null,
    });
    return NextResponse.json({ success: true, data: { value, creditsRemaining: charge.remaining } });
  } catch (error) {
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_SUGGEST,
        campaignId: id,
        reason: "Refund: AI suggest failed",
      });
    }
    const message = error instanceof Error ? error.message : "Suggestion failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
