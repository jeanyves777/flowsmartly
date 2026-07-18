import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { patchShot } from "@/lib/clone-studio/store";
import { renderShot } from "@/lib/clone-studio/engines";

/** POST — render ONE shot. Fire-and-forget; the canvas polls. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; shotId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, shotId } = await params;
  const project = await patchShot(id, session.userId, shotId, { status: "rendering", progress: 4, error: null, renderHeartbeatAt: Date.now() });
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  void renderShot(id, session.userId, shotId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
