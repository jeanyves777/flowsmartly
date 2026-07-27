import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getNarration, patchNarrationPresenter, patchNarrationFinal } from "@/lib/voice-studio/store";
import { generateAllShots } from "@/lib/voice-studio/engines";

/** POST — queue every unfinished shot; a bounded drainer keeps 3 in flight. For an
 *  on-camera explainer the presenter take is kicked SEQUENTIALLY once every beat is
 *  ready (in drainShots), so step 3 never shows a premature failure while step 2 runs. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  // Reset a stale presenter + final so step 3 shows "waiting" (not an old failure) while beats
  // render, and the fresh run re-stitches instead of surfacing the previous video.
  const pre = await getNarration(id, session.userId);
  if (pre?.mode === "oncam") {
    await patchNarrationPresenter(id, session.userId, {
      presenterStatus: "idle", presenterError: null, presenterErrorDebug: null, presenterVideoUrl: null,
    }).catch(() => {});
    await patchNarrationFinal(id, session.userId, {
      finalStatus: "idle", finalVideoUrl: null, finalProgress: 0,
    }).catch(() => {});
  }
  const res = await generateAllShots(id, session.userId);
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message || "Could not start." } }, { status: 400 });
  const project = await getNarration(id, session.userId);
  return NextResponse.json({ success: true, data: await presignAllUrls({ project, queued: res.queued, message: res.message }) });
}
