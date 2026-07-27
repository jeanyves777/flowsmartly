import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration } from "@/lib/voice-studio/store";
import { generateAllShots, renderPresenter } from "@/lib/voice-studio/engines";

/** POST — queue every unfinished shot; a bounded drainer keeps 3 in flight.
 *  For an on-camera explainer, also kick the continuous Avatar IV presenter take
 *  (once a presenter photo is set) so it renders alongside the beats. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const res = await generateAllShots(id, session.userId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not start." } }, { status: 400 });
  const project = await getNarration(id, session.userId);
  if (
    project?.mode === "oncam" &&
    /^https?:\/\//i.test(project.presenterImageUrl || "") &&
    project.presenterStatus !== "rendering"
  ) {
    void renderPresenter(id, session.userId);
  }
  return NextResponse.json({ success: true, data: await presignAllUrls({ project, queued: res.queued, message: res.message }) });
}
