import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  chargeStoryAdCampaignUsage,
  generateClipVoicePreview,
  generateFullScreenplayPreview,
  getCampaign,
  refundStoryAdCampaignUsage,
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
    mode?: "screenplay" | "clip" | "line";
    clipId?: string;
    text?: string;
    characterId?: string;
  };

  // Count lines we're about to generate so we charge accurately.
  let lineCount = 0;
  if (body.mode === "screenplay") {
    lineCount = current.state.clips.reduce((s, c) => s + c.dialogue.filter((d) => d.line.trim()).length, 0);
  } else if (body.clipId) {
    const clip = current.state.clips.find((c) => c.id === body.clipId);
    lineCount = clip ? clip.dialogue.filter((d) => d.line.trim()).length : 0;
  } else if (body.text) {
    lineCount = 1;
  }

  if (lineCount === 0) {
    return NextResponse.json(
      { success: false, error: { message: "Nothing to preview." } },
      { status: 400 },
    );
  }

  const isAdmin = !!session.adminId;
  const charge = await chargeStoryAdCampaignUsage({
    userId: session.userId,
    isAdmin,
    costKey: "AI_STORY_CAMPAIGN_VOICE_LINE",
    multiplier: lineCount,
    campaignId: id,
    description:
      body.mode === "screenplay"
        ? `Story Ad Campaign: voice the full screenplay (${lineCount} lines)`
        : `Story Ad Campaign: voice preview (${lineCount} line${lineCount === 1 ? "" : "s"})`,
  });
  if (!charge.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INSUFFICIENT_CREDITS",
          message: `Voicing ${lineCount} line${lineCount === 1 ? "" : "s"} costs ${charge.required} credits. You have ${charge.available} remaining.`,
          required: charge.required,
          available: charge.available,
        },
      },
      { status: 402 },
    );
  }

  try {
    if (body.mode === "screenplay") {
      const result = await generateFullScreenplayPreview({
        clips: current.state.clips,
        characters: current.state.characters,
      });
      return NextResponse.json({
        success: true,
        data: {
          lines: result.lines,
          totalDurationMs: result.totalDurationMs,
          mode: "screenplay",
          creditsRemaining: charge.remaining,
        },
      });
    }

    const clip = body.clipId ? current.state.clips.find((c) => c.id === body.clipId) : null;
    const singleCharacter = body.characterId
      ? current.state.characters.find((c) => c.id === body.characterId) || null
      : null;

    const result = await generateClipVoicePreview({
      clip: clip || undefined,
      characters: current.state.characters,
      text: body.text,
      character: singleCharacter,
    });
    return NextResponse.json({
      success: true,
      data: {
        lines: result.lines,
        totalDurationMs: result.totalDurationMs,
        mode: clip ? "clip" : "line",
        creditsRemaining: charge.remaining,
      },
    });
  } catch (error) {
    if (!isAdmin) {
      await refundStoryAdCampaignUsage({
        userId: session.userId,
        amount: DEFAULT_CREDIT_COSTS.AI_STORY_CAMPAIGN_VOICE_LINE * lineCount,
        campaignId: id,
        reason: "Refund: voice preview failed",
      });
    }
    const message = error instanceof Error ? error.message : "Voice preview failed";
    return NextResponse.json({ success: false, error: { message } }, { status: 500 });
  }
}
