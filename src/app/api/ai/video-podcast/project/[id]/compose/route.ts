import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getProject, patchProject } from "@/lib/video-podcast/store";
import { composePodcast } from "@/lib/video-podcast/engines";

/** POST — cut + stitch the ready turns into the final podcast. Fire-and-forget; poll finalStatus. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  if (!project.turns.some((t) => t.status === "ready")) {
    return NextResponse.json({ success: false, error: { message: "Render the turns before composing the podcast." } }, { status: 400 });
  }
  const seeded = await patchProject(id, session.userId, { finalStatus: "rendering", finalProgress: 5, finalHeartbeatAt: Date.now(), finalTries: 0 });
  void composePodcast(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project: seeded ?? project }) });
}
