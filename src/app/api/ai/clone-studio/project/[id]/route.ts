import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getProject, saveProject, deleteProject } from "@/lib/clone-studio/store";
import { syncCloneProject } from "@/lib/clone-studio/engines";
import { normalizeProject, type CloneProject } from "@/lib/clone-studio/types";

/** GET — the whole project. Reconciles renders orphaned by a restart, on open. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const live = project.shots.some((s) => s.status === "rendering" || s.status === "queued");
  const synced = live ? await syncCloneProject(project, session.userId) : project;
  return NextResponse.json({ success: true, data: await presignAllUrls({ project: synced }) });
}

/** PATCH — the canvas autosaves the whole project (clones, shots, edits). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { project?: Partial<CloneProject> };
  if (!body.project) return NextResponse.json({ success: false, error: { message: "No project" } }, { status: 400 });
  const ok = await saveProject(id, session.userId, normalizeProject({ ...body.project, id }));
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
