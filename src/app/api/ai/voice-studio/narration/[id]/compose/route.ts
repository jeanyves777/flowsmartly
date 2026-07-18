import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, saveNarration } from "@/lib/voice-studio/store";
import { composeNarration } from "@/lib/voice-studio/engines";

/** POST — stitch the ready shots + the narration into one film. Poll finalStatus. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  if (!project.shots.some((s) => s.status === "ready")) {
    return NextResponse.json({ success: false, error: { message: "Render at least one shot before stitching." } }, { status: 400 });
  }
  project.finalStatus = "rendering";
  project.finalProgress = 5;
  // Claim it up front so the recovery sweep can tell a live stitch from a dead one.
  project.finalHeartbeatAt = Date.now();
  await saveNarration(id, session.userId, project);
  void composeNarration(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
