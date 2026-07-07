import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readReelCampaigns, readLatestReelCampaign, buildReelsFromTranscript } from "@/lib/reel/reel-editor";
import type { Transcript } from "@/lib/reel/highlights";
import { transcribeVideoUrl, renderCampaignClipsDetached } from "@/lib/reel/reel-pipeline";

// GET /api/reels — the user's reel campaigns (+ ?latest=1 for just the newest).
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const latestOnly = new URL(req.url).searchParams.get("latest") === "1";
    if (latestOnly) {
      const campaign = await readLatestReelCampaign(session.userId);
      return NextResponse.json({ campaign });
    }
    const campaigns = await readReelCampaigns(session.userId);
    return NextResponse.json({ campaigns, latest: campaigns[0] || null });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/reels — build a campaign from a transcript (Reel Studio "Build reels").
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
    const sourceFileUrl = typeof body.sourceFileUrl === "string" ? body.sourceFileUrl : null;

    const t = body.transcript as { segments?: unknown } | undefined;
    const segs = Array.isArray(t?.segments) ? t!.segments : [];

    let transcript: Transcript;
    let durationSec = typeof body.durationSec === "number" ? body.durationSec : 0;
    if (segs.length > 0) {
      transcript = {
        segments: (segs as Array<Record<string, unknown>>)
          .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "") }))
          .filter((s) => s.end > s.start && s.text.trim()),
      };
    } else if (sourceFileUrl) {
      // Real ingest: transcribe the uploaded source (ffmpeg audio → whisper).
      const res = await transcribeVideoUrl(sourceFileUrl);
      transcript = res.transcript;
      if (!durationSec) durationSec = res.durationSec;
    } else {
      return NextResponse.json({ error: "Provide a transcript { segments } or a sourceFileUrl to transcribe" }, { status: 400 });
    }

    const campaign = await buildReelsFromTranscript({
      userId: session.userId,
      title,
      sourceType: sourceFileUrl ? "upload" : "link",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      sourceFileUrl,
      durationSec,
      transcript,
      settings: (body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>,
    });
    // Kick the ffmpeg render worker for the clips (fire-and-forget; degrades if no ffmpeg).
    if (sourceFileUrl) renderCampaignClipsDetached(campaign.id);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Build failed" }, { status: 400 });
  }
}
