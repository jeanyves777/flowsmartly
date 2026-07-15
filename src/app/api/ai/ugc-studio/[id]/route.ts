import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getUgcProject, saveUgcProject, deleteUgcProject } from "@/lib/ugc-studio/store";
import { syncUgcProject } from "@/lib/ugc-studio/engines";
import { clampDuration } from "@/lib/ugc-studio/types";

/** GET — one project's full state; resumes any orphaned renders + refills the queue. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getUgcProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const synced = project.takes.some((t) => t.status === "rendering" || t.status === "queued")
    ? await syncUgcProject(project, session.userId)
    : project;
  const data = await presignAllUrls({ project: synced });
  return NextResponse.json({ success: true, data });
}

/** PATCH — edit the brief and/or move/resize/delete a take (free, no render). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const project = await getUgcProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  // brief fields
  if (typeof body?.title === "string") project.title = body.title.slice(0, 160);
  if (typeof body?.template === "string") project.template = body.template;
  if (typeof body?.script === "string") project.script = body.script.slice(0, 2000);
  if (typeof body?.photoUrl === "string" || body?.photoUrl === null) project.photoUrl = body.photoUrl;
  if (typeof body?.style === "string") project.style = body.style.slice(0, 60);
  if (body?.aspect === "9:16" || body?.aspect === "1:1") project.aspect = body.aspect;
  if (typeof body?.durationSec === "number") project.durationSec = clampDuration(body.durationSec);
  // move / resize a take
  if (body?.takePatch?.id) {
    const t = project.takes.find((x) => x.id === body.takePatch.id);
    if (t) {
      if (typeof body.takePatch.x === "number") t.x = Math.max(0, body.takePatch.x);
      if (typeof body.takePatch.y === "number") t.y = Math.max(0, body.takePatch.y);
      if (typeof body.takePatch.w === "number") t.w = Math.max(160, Math.min(380, body.takePatch.w));
    }
  }
  // delete a take
  if (typeof body?.deleteTakeId === "string") project.takes = project.takes.filter((t) => t.id !== body.deleteTakeId);

  await saveUgcProject(id, session.userId, project);
  const data = await presignAllUrls({ project });
  return NextResponse.json({ success: true, data });
}

/** DELETE — remove the whole project. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const ok = await deleteUgcProject(id, session.userId);
  return NextResponse.json({ success: ok });
}
