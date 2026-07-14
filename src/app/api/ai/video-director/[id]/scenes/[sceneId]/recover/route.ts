import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { recoverSceneRender } from "@/lib/video-director/engines";

/** POST - force-check and pull an existing Grok/Veo render without generating again. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, sceneId } = await params;
  const res = await recoverSceneRender(id, session.userId, sceneId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not pull the render." } }, { status: 409 });
  const data = await presignAllUrls({ film: res.film, state: res.state, message: res.message });
  return NextResponse.json({ success: true, data });
}
