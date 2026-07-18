import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { startSceneVideoEdit } from "@/lib/video-director/engines";

/** POST - edit a ready Director AI clip with xAI grok-imagine-video. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, sceneId } = await params;
  const body = (await request.json().catch(() => ({}))) as { prompt?: unknown };
  if (typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ success: false, error: { message: "Describe what should be fixed in the video." } }, { status: 400 });
  }
  const result = await startSceneVideoEdit(id, session.userId, sceneId, body.prompt);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: { message: result.message || "The video edit could not start." } }, { status: 400 });
  }
  const data = await presignAllUrls({ film: result.film });
  return NextResponse.json({ success: true, data });
}
