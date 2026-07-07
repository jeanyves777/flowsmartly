import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readReelCampaigns, readLatestReelCampaign, buildReelsFromTranscript } from "@/lib/reel/reel-editor";
import type { Transcript } from "@/lib/reel/highlights";

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
    const t = body.transcript as { segments?: unknown } | undefined;
    const segs = Array.isArray(t?.segments) ? t!.segments : [];
    if (!title) return NextResponse.json({ error: "A title is required" }, { status: 400 });
    if (segs.length === 0) return NextResponse.json({ error: "A transcript { segments } is required" }, { status: 400 });

    const transcript: Transcript = {
      segments: (segs as Array<Record<string, unknown>>)
        .map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || "") }))
        .filter((s) => s.end > s.start && s.text.trim()),
    };
    const campaign = await buildReelsFromTranscript({
      userId: session.userId,
      title,
      sourceType: body.sourceType === "upload" ? "upload" : "link",
      sourceUrl: typeof body.sourceUrl === "string" ? body.sourceUrl : null,
      durationSec: typeof body.durationSec === "number" ? body.durationSec : 0,
      transcript,
      settings: (body.settings && typeof body.settings === "object" ? body.settings : {}) as Record<string, unknown>,
    });
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Build failed" }, { status: 400 });
  }
}
