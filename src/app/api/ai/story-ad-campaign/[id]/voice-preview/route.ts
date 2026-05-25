import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  generateClipVoicePreview,
  generateFullScreenplayPreview,
  getCampaign,
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

  const body = (await request.json().catch(() => ({}))) as {
    mode?: "screenplay" | "clip" | "line";
    clipId?: string;
    text?: string;
    characterId?: string;
  };

  try {
    // Full continuous screenplay — every clip, every line, in order
    if (body.mode === "screenplay") {
      if (!current.state.clips.length) {
        return NextResponse.json(
          { success: false, error: { message: "No clips planned yet." } },
          { status: 400 },
        );
      }
      const result = await generateFullScreenplayPreview({
        clips: current.state.clips,
        characters: current.state.characters,
      });
      return NextResponse.json({
        success: true,
        data: { lines: result.lines, totalDurationMs: result.totalDurationMs, mode: "screenplay" },
      });
    }

    // Per-clip dialogue voicing, or single line
    const clip = body.clipId ? current.state.clips.find((c) => c.id === body.clipId) : null;
    const singleCharacter = body.characterId
      ? current.state.characters.find((c) => c.id === body.characterId) || null
      : null;

    if (!clip && !body.text) {
      return NextResponse.json(
        { success: false, error: { message: "Nothing to preview." } },
        { status: 400 },
      );
    }

    const result = await generateClipVoicePreview({
      clip: clip || undefined,
      characters: current.state.characters,
      text: body.text,
      character: singleCharacter,
    });
    return NextResponse.json({
      success: true,
      data: { lines: result.lines, totalDurationMs: result.totalDurationMs, mode: clip ? "clip" : "line" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voice preview failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
