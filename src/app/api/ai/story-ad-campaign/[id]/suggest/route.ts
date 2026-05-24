import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getBrandSnapshot, getCampaign, suggestField } from "@/lib/story-ad-campaign";

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
    return NextResponse.json({ success: true, data: { value } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Suggestion failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
