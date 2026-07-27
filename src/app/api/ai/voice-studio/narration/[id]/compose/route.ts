import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, saveNarration } from "@/lib/voice-studio/store";
import { composeNarration, composeOnCam } from "@/lib/voice-studio/engines";

/** POST — stitch into one film. On-camera explainers overlay the Avatar IV presenter
 *  over the per-beat graphics/b-roll; everything else stitches the narrated shots.
 *  Poll finalStatus. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const project = await getNarration(id, session.userId);
  if (!project) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  const isOnCam = project.mode === "oncam";
  if (isOnCam) {
    if (!/^https?:\/\//i.test(project.presenterVideoUrl || "")) {
      return NextResponse.json({ success: false, error: { message: "Render the presenter first — run Generate all." } }, { status: 400 });
    }
  } else if (!project.shots.some((s) => s.status === "ready")) {
    return NextResponse.json({ success: false, error: { message: "Render at least one shot before stitching." } }, { status: 400 });
  }

  project.finalStatus = "rendering";
  project.finalProgress = 5;
  // Claim it up front so the recovery sweep can tell a live stitch from a dead one.
  project.finalHeartbeatAt = Date.now();
  await saveNarration(id, session.userId, project);
  if (isOnCam) void composeOnCam(id, session.userId);
  else void composeNarration(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project }) });
}
