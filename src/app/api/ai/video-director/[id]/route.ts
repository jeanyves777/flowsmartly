import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getFilm, saveFilm, deleteFilm } from "@/lib/video-director/store";
import { syncFilmScenes } from "@/lib/video-director/engines";
import { normalizeFilm, type FilmProject } from "@/lib/video-director/types";

/** GET — one film's full state (canvas nodes, edges, timeline) for the studio. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const film = await getFilm(id, session.userId);
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  // Reconcile any scenes/overlays before returning. This also pulls completed
  // provider videos for interrupted AI scenes that still have a Grok/Veo handle.
  const rendering = (st?: string) => st === "rendering" || st === "queued";
  const recoverableFailed = (s: { status?: string; refKind?: string; refId?: string | null }) =>
    s.status === "failed" && !!s.refId && (s.refKind === "grok" || s.refKind === "veo3");
  const synced = film.scenes.some((s) => rendering(s.status) || recoverableFailed(s) || rendering(s.overlay?.status))
    ? await syncFilmScenes(film, session.userId)
    : film;
  const data = await presignAllUrls({ film: synced });
  return NextResponse.json({ success: true, data });
}

/** PATCH — save the whole film (the canvas autosaves the full FilmProject). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { project?: Partial<FilmProject> & { id?: string } };
  if (!body.project || typeof body.project !== "object") {
    return NextResponse.json({ success: false, error: { message: "A film project is required." } }, { status: 400 });
  }
  const clean = normalizeFilm({ ...body.project, id });
  const ok = await saveFilm(id, session.userId, clean);
  return ok
    ? NextResponse.json({ success: true, data: { saved: true } })
    : NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
}

/** DELETE — remove a film. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const ok = await deleteFilm(id, session.userId);
  return ok
    ? NextResponse.json({ success: true, data: { deleted: true } })
    : NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
}
