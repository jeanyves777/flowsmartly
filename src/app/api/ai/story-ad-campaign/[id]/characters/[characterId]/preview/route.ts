import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  generateCharacterPreviewImage,
  getBrandSnapshot,
  getCampaign,
  updateCampaignState,
} from "@/lib/story-ad-campaign";

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
    return NextResponse.json({ success: true, data: { state: merged } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview generation failed";
    const failed = generatingChars.map((c) =>
      c.id === characterId ? { ...c, previewStatus: "failed" as const, previewError: message } : c,
    );
    await updateCampaignState(id, session.userId, { characters: failed });
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
