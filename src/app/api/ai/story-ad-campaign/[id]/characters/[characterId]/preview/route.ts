import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  generateCharacterPreviewImage,
  getBrandSnapshot,
  getCampaign,
  refundStoryAdCampaignUsage,
  saveCharacterPreviewToLibrary,
  updateCampaignState,
} from "@/lib/story-ad-campaign";
import { DEFAULT_CREDIT_COSTS } from "@/lib/credits/costs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }
  const { id, characterId } = await params;
  const current = await getCampaign(id, session.userId);
  if (!current) {
    return NextResponse.json({ success: false, error: { message: "Campaign not found" } }, { status: 404 });
  }
  const character = current.state.characters.find((c) => c.id === characterId);
  if (!character) {
    return NextResponse.json({ success: false, error: { message: "Character not found" } }, { status: 404 });
  }

  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_CARTOON_CHARACTER_REGEN",
    campaignId: id,
    description: `Story Ad Campaign: character preview (${character.name})`,
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

  // Mark generating
  const generatingChars = current.state.characters.map((c) =>
    c.id === characterId ? { ...c, previewStatus: "generating" as const, previewError: null } : c,
  );
  await updateCampaignState(id, session.userId, { characters: generatingChars });

  try {
    const brand = await getBrandSnapshot(session.userId);
    const imageUrl = await generateCharacterPreviewImage(character, current.state, brand, id);

    const next = generatingChars.map((c) =>
      c.id === characterId
        ? {
            ...c,
            referenceImageUrl: imageUrl,
            previewStatus: "ready" as const,
            previewError: null,
            // any edit invalidates approval — regenerating image counts as edit
            approved: false,
          }
        : c,
    );
    const merged = await updateCampaignState(id, session.userId, { characters: next });

    // Drop the generated portrait into the user's media library so they can reuse the
    // character across campaigns. Fire-and-forget — library failures must not affect
    // the user's flow.
    void saveCharacterPreviewToLibrary({
      userId: session.userId,
      campaignId: id,
      campaignTitle: current.state.brief?.slice(0, 60) || "Campaign",
      characterName: character.name,
      characterRole: character.role,
      imageUrl,
    });

    return NextResponse.json({ success: true, data: { state: merged, creditsRemaining: charge.remaining } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed";
    const failed = generatingChars.map((c) =>
      c.id === characterId ? { ...c, previewStatus: "failed" as const, previewError: message } : c,
    );
    await updateCampaignState(id, session.userId, { characters: failed });
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_CARTOON_CHARACTER_REGEN,
        campaignId: id,
        reason: "Refund: character preview generation failed",
      });
    }
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
