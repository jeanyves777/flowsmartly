import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getProject } from "@/lib/video-podcast/store";
import { generateAllTurns } from "@/lib/video-podcast/engines";

/** POST — render every pending turn. Fire-and-forget; the studio polls. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const res = await generateAllTurns(id, session.userId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not start." } }, { status: 400 });
  const project = await getProject(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project, queued: res.queued, message: res.message }) });
}
