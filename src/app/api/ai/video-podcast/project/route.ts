import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { createProject, listProjects } from "@/lib/video-podcast/store";
import type { PodcastProject } from "@/lib/video-podcast/types";

/** GET — the podcast library. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const items = await listProjects(session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ items }) });
}

/** POST — start a podcast (seeded with speakers + brief + settings). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Partial<PodcastProject>;
  const project = await createProject(session.userId, body);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
