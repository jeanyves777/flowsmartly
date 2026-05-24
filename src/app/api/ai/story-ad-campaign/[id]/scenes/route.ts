import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getBrandSnapshot,
  getCampaign,
  planSceneGrid,
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
  if (!current.state.characters.length) {
    return NextResponse.json(
      { success: false, error: { message: "Build the character catalog first." } },
      { status: 400 },
    );
  }

  try {
    const brand = await getBrandSnapshot(session.userId);
    const clips = await planSceneGrid(current.state, brand);
    const merged = await updateCampaignState(id, session.userId, {
      clips,
      phase: "PROMPTS",
    });
    return NextResponse.json({ success: true, data: { state: merged } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to plan scene grid";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
