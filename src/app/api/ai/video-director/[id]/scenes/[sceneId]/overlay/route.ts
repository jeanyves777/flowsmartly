import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { generateSceneOverlay } from "@/lib/video-director/engines";

/** POST — render a scene's PiP overlay on its own engine. Returns the updated film. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, sceneId } = await params;
  const res = await generateSceneOverlay(id, session.userId, sceneId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Overlay generation failed" } }, { status: 400 });
  const data = await presignAllUrls({ film: res.film });
  return NextResponse.json({ success: true, data });
}
