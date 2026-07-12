import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { draftFilmAsync } from "@/lib/video-director/draft";
import { getFilm, saveFilm } from "@/lib/video-director/store";

export const maxDuration = 300;

/**
 * POST — the director drafts a scene pipeline from the film's brief (free).
 * Storyboarding a long movie is a heavy LLM call that can exceed the request
 * timeout, so we mark the film "drafting", run the storyboard in the BACKGROUND,
 * and return immediately — the canvas polls draftStatus for the result. This
 * fixes the "Build film → empty canvas / timed-out request" bug.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const film = await getFilm(id, session.userId);
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });

  // Flag drafting + clear any prior scenes so the poll clearly sees a fresh draft.
  film.draftStatus = "drafting";
  film.scenes = [];
  await saveFilm(id, session.userId, film);
  void draftFilmAsync(id, session.userId); // fire-and-forget (VPS is long-lived)

  const data = await presignAllUrls({ film });
  return NextResponse.json({ success: true, data });
}
