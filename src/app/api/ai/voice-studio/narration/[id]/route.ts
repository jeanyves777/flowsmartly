import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, saveNarration, deleteNarration } from "@/lib/voice-studio/store";
import { syncNarration } from "@/lib/voice-studio/engines";
import { normalizeNarration, type NarrationProject } from "@/lib/voice-studio/types";

/** GET — the whole narration. Reconciles anything a restart orphaned, on open. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  // Reconcile on open: live renders, a stitch, OR a stuck draft (a deploy-orphaned
  // "drafting" is re-run here so the canvas can't spin on it forever).
  const live = project.draftStatus === "drafting"
    || project.finalStatus === "rendering"
    || project.shots.some((s) => s.status === "rendering" || s.status === "queued");
  const synced = live ? await syncNarration(project, session.userId) : project;
  return NextResponse.json({ success: true, data: await presignAllUrls({ project: synced }) });
}

/** PATCH — the canvas autosaves the whole project. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { project?: Partial<NarrationProject> };
  if (!body.project) return NextResponse.json({ success: false, error: { message: "No project" } }, { status: 400 });
  const ok = await saveNarration(id, session.userId, normalizeNarration({ ...body.project, id }));
  if (!ok) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const ok = await deleteNarration(id, session.userId);
  return NextResponse.json({ success: ok });
}
