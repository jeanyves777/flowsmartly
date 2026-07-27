import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createNarration, listNarrations } from "@/lib/voice-studio/store";
import { draftNarration } from "@/lib/voice-studio/draft";
import type { NarrationProject } from "@/lib/voice-studio/types";

/** GET — the narration library. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const items = await listNarrations(session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ items }) });
}

/**
 * POST — start a narration. Drafting (script + cast + every shot prompt) runs in the
 * BACKGROUND and the canvas polls draftStatus, so a long storyboard can't time out
 * the request.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<NarrationProject>;

  const mode = body.mode || "film";
  const project = await createNarration(session.userId, {
    title: body.title || "Untitled narration",
    brief: body.brief || "",
    script: body.script || "",
    mode,
    treatment: body.treatment || "mixed",
    // On-camera explainers are vertical by default (Reels/Shorts/TikTok).
    aspect: body.aspect || (mode === "oncam" ? "9:16" : "16:9"),
    narrationStyle: body.narrationStyle || "documentary",
    voice: body.voice,
    takeCount: body.takeCount ?? 2,
    captionsOn: body.captionsOn ?? (mode === "oncam"),
    presenterImageUrl: body.presenterImageUrl ?? null,
    presenterMotion: body.presenterMotion ?? null,
    // A voiceover needs no storyboard — it's just the read. Film + on-camera both draft.
    draftStatus: mode === "voiceover" ? "ready" : "drafting",
  });
  if (mode === "film" || mode === "oncam") void draftNarration(project.id, session.userId);
  return NextResponse.json({ success: true, data: { project } });
}
