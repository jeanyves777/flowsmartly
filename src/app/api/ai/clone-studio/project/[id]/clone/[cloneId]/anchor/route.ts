import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { patchClone } from "@/lib/clone-studio/store";
import { buildCloneAnchor } from "@/lib/clone-studio/engines";

/** POST — build this clone's clean hero anchor from its uploaded photos. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string; cloneId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, cloneId } = await params;
  // Mark it building so the canvas can show a loader while the anchor renders.
  await patchClone(id, session.userId, cloneId, {}).catch(() => {});
  const project = await buildCloneAnchor(id, session.userId, cloneId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
