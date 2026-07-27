import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getNarration, saveNarration } from "@/lib/voice-studio/store";
import { draftNarration } from "@/lib/voice-studio/draft";
import type { NarrationProject } from "@/lib/voice-studio/types";

/**
 * POST — (re)draft the flow from the brief: script, cast, and a prompt for every
 * shot. Background; the canvas polls draftStatus.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<NarrationProject>;

  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  // Apply the brief edits that triggered this re-draft, then storyboard from them.
  Object.assign(project, {
    brief: body.brief ?? project.brief,
    title: body.title ?? project.title,
    treatment: body.treatment ?? project.treatment,
    aspect: body.aspect ?? project.aspect,
    narrationStyle: body.narrationStyle ?? project.narrationStyle,
    voice: body.voice ?? project.voice,
    targetSec: body.targetSec ?? project.targetSec,
    mode: body.mode ?? project.mode,
    presenterImageUrl: body.presenterImageUrl ?? project.presenterImageUrl,
    presenterMotion: body.presenterMotion ?? project.presenterMotion,
    draftStatus: "drafting",
    draftError: null,
  });
  await saveNarration(id, session.userId, project);
  void draftNarration(id, session.userId);
  return NextResponse.json({ success: true, data: { project } });
}
