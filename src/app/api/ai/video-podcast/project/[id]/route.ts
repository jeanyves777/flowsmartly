import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getProject, saveProject, deleteProject } from "@/lib/video-podcast/store";
import { resumeStuckPodcast } from "@/lib/video-podcast/engines";
import { normalizePodcast, type PodcastProject } from "@/lib/video-podcast/types";

/** GET — the whole project. Reconciles renders orphaned by a restart, on open. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const busy = project.draftStatus === "drafting" || project.finalStatus === "rendering" || project.turns.some((t) => t.status === "rendering" || t.status === "queued");
  if (busy) { void resumeStuckPodcast(id, session.userId).catch(() => {}); }
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}

/** PATCH — the studio saves the whole project (speakers, brief, turns, settings). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { project?: Partial<PodcastProject> };
  if (!body.project) return NextResponse.json({ success: false, error: { message: "No project" } }, { status: 400 });
  const ok = await saveProject(id, session.userId, normalizePodcast({ ...body.project, id }));
  if (!ok) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const ok = await deleteProject(id, session.userId);
  return NextResponse.json({ success: ok });
}
