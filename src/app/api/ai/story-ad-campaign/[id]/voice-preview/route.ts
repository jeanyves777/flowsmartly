import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { generateClipVoicePreview, getCampaign } from "@/lib/story-ad-campaign";

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
    clipId?: string;
    text?: string;
  };
  const clip = current.state.clips.find((c) => c.id === body.clipId);
  const text = (body.text || clip?.voiceoverLine || "").trim();
  if (!text) {
    return NextResponse.json(
      { success: false, error: { message: "No voiceover line to preview." } },
      { status: 400 },
    );
  }

  const character = clip
    ? current.state.characters.find((c) => c.id === clip.characterId) || null
    : null;

  try {
    const result = await generateClipVoicePreview({ text, character });
    return NextResponse.json({
      success: true,
      data: {
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        estimatedDurationMs: result.estimatedDurationMs,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice preview failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
