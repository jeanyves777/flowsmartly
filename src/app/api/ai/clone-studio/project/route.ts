import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createProject, listProjects } from "@/lib/clone-studio/store";
import type { CloneProject } from "@/lib/clone-studio/types";

/** GET — the clone library. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const items = await listProjects(session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ items }) });
}

/** POST — start a clone session (optionally seeded with a first clone). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<CloneProject>;
  const project = await createProject(session.userId, {
    title: body.title || "Clone session",
    clones: body.clones,
    shots: body.shots,
    activeCloneId: body.activeCloneId,
  });
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
