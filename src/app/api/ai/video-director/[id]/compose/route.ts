import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getFilm, saveFilm } from "@/lib/video-director/store";
import { composeFilm } from "@/lib/video-director/engines";

/** POST — stitch the ready scenes into one final film (fire-and-forget; poll finalStatus). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;

  const film = await getFilm(id, session.userId);
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const ready = film.scenes.filter((s) => s.status === "ready");
  if (ready.length === 0) {
    return NextResponse.json({ success: false, error: { message: "Generate at least one scene before stitching." } }, { status: 400 });
  }

  film.finalStatus = "rendering";
  film.finalProgress = 5;
  await saveFilm(id, session.userId, film);
  void composeFilm(id, session.userId);

  return NextResponse.json({ success: true, data: { film } });
}
