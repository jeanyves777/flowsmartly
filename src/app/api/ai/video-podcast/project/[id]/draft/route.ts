import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getProject, patchProject } from "@/lib/video-podcast/store";
import { draftPodcast } from "@/lib/video-podcast/engines";

/** POST — write the conversation (or parse the transcript) + build the set backdrop.
 *  Fire-and-forget; the studio polls draftStatus. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getProject(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  if (!project.brief.trim()) return NextResponse.json({ success: false, error: { message: "Add what the episode should be about first." } }, { status: 400 });
  const seeded = await patchProject(id, session.userId, { draftStatus: "drafting", draftError: null, draftStartedAt: Date.now(), draftTries: 0 });
  void draftPodcast(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project: seeded ?? project }) });
}
