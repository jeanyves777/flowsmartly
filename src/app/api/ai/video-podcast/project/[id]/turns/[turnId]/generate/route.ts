import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { patchTurn } from "@/lib/video-podcast/store";
import { renderTurn } from "@/lib/video-podcast/engines";

/** POST — render ONE turn. Fire-and-forget; the studio polls. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; turnId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, turnId } = await params;
  const project = await patchTurn(id, session.userId, turnId, { status: "rendering", progress: 4, error: null, renderHeartbeatAt: Date.now() });
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  void renderTurn(id, session.userId, turnId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
