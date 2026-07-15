import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getTryOnProject, saveTryOnProject, deleteTryOnProject } from "@/lib/try-on/store";
import { syncTryOnProject } from "@/lib/try-on/engines";
import { clampTryOnDuration } from "@/lib/try-on/types";

/** GET — full state; resumes orphaned renders + refills the queue. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getTryOnProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const synced = project.takes.some((t) => t.status === "rendering" || t.status === "queued")
    ? await syncTryOnProject(project, session.userId)
    : project;
  const data = await presignAllUrls({ project: synced });
  return NextResponse.json({ success: true, data });
}

/** PATCH — edit the brief and/or move/resize/delete a take (free). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const project = await getTryOnProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  if (typeof body?.title === "string") project.title = body.title.slice(0, 160);
  if (typeof body?.template === "string") project.template = body.template;
  if (typeof body?.prompt === "string") project.prompt = body.prompt.slice(0, 2000);
  if (typeof body?.personImageUrl === "string" || body?.personImageUrl === null) project.personImageUrl = body.personImageUrl;
  if (typeof body?.outfitImageUrl === "string" || body?.outfitImageUrl === null) project.outfitImageUrl = body.outfitImageUrl;
  if (body?.aspect === "3:4" || body?.aspect === "9:16" || body?.aspect === "1:1") project.aspect = body.aspect;
  if (typeof body?.durationSec === "number") project.durationSec = clampTryOnDuration(body.durationSec);
  if (body?.takePatch?.id) {
    const t = project.takes.find((x) => x.id === body.takePatch.id);
    if (t) {
      if (typeof body.takePatch.x === "number") t.x = Math.max(0, body.takePatch.x);
      if (typeof body.takePatch.y === "number") t.y = Math.max(0, body.takePatch.y);
      if (typeof body.takePatch.w === "number") t.w = Math.max(160, Math.min(420, body.takePatch.w));
    }
  }
  if (typeof body?.deleteTakeId === "string") project.takes = project.takes.filter((t) => t.id !== body.deleteTakeId);

  await saveTryOnProject(id, session.userId, project);
  const data = await presignAllUrls({ project });
  return NextResponse.json({ success: true, data });
}

/** DELETE — remove the project. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const ok = await deleteTryOnProject(id, session.userId);
  return NextResponse.json({ success: ok });
}
