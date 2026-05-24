import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getBrandSnapshot,
  getCampaign,
  planCharacterCatalog,
  updateCampaignState,
} from "@/lib/story-ad-campaign";

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
  if (!current.state.style) {
    return NextResponse.json(
      { success: false, error: { message: "Choose a campaign style first." } },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { count?: number };
  const count = Math.max(1, Math.min(6, Number(body.count) || 3));

  try {
    const brand = await getBrandSnapshot(session.userId);
    const plan = await planCharacterCatalog(current.state, brand, count);
    const merged = await updateCampaignState(id, session.userId, {
      characters: plan.characters,
      storyOutline: plan.storyOutline,
      phase: "CHARACTERS",
    });
    return NextResponse.json({ success: true, data: { state: merged } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to plan character catalog";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
