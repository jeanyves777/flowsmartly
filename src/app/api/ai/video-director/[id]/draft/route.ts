import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { draftFilmPipeline } from "@/lib/video-director/draft";

// Storyboarding a long movie is a heavy LLM call — give it real headroom so it
// isn't cut off mid-draft (which returned nothing and left the canvas empty).
export const maxDuration = 300;

/** POST — the director drafts a scene pipeline from the film's brief (free). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  try {
    const film = await draftFilmPipeline(id, session.userId);
    if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
    const data = await presignAllUrls({ film });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error("[video-director] draft failed:", e);
    return NextResponse.json({ success: false, error: { message: "The director couldn't storyboard the film — please try again." } }, { status: 500 });
  }
}
