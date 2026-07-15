import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { generateAllScenes } from "@/lib/video-director/engines";

/**
 * POST /api/ai/video-director/[id]/generate-all — batch-generate every not-yet-ready
 * scene. Queues them all and starts a few; a bounded drainer refills as renders finish
 * (event-driven + cron), so the batch persists if the user leaves the page. Returns the
 * updated film so the client can show the global progress loader immediately.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const res = await generateAllScenes(id, session.userId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Couldn't start the batch." } }, { status: 400 });
  const data = await presignAllUrls({ film: res.film, queued: res.queued, started: res.started });
  return NextResponse.json({ success: true, data });
}
