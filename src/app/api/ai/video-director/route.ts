import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createFilm, listFilms } from "@/lib/video-director/store";
import { FILM_ASPECTS, FILM_TYPES, type FilmAsset, type FilmAspect, type FilmType } from "@/lib/video-director/types";

/** GET — list the user's Director films (for History / New-video picker). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const films = await listFilms(session.userId);
  return NextResponse.json({ success: true, data: { films } });
}

/** POST — create a new film from the master brief (title/brief/type/aspect/length + uploaded assets). */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const aspect = FILM_ASPECTS.includes(body.aspect as FilmAspect) ? (body.aspect as FilmAspect) : "9:16";
  const filmType = FILM_TYPES.includes(body.filmType as FilmType) ? (body.filmType as FilmType) : "product_ad";
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 200) : undefined);
  const film = await createFilm(session.userId, {
    title: typeof body.title === "string" && body.title.trim() ? body.title.slice(0, 160) : "Untitled film",
    brief: typeof body.brief === "string" ? body.brief.slice(0, 8000) : "",
    filmType,
    aspect,
    targetSeconds: typeof body.targetSeconds === "number" ? body.targetSeconds : 30,
    sceneCount: typeof body.sceneCount === "number" ? Math.max(1, Math.min(10, Math.round(body.sceneCount))) : null,
    style: ["cinematic", "3d", "narrated"].includes(String(body.style)) ? String(body.style) : "cinematic",
    quality: body.quality === "standard" ? "standard" : "avatar_iv",
    avatarId: s(body.avatarId), avatarName: s(body.avatarName),
    voiceId: s(body.voiceId), voiceName: s(body.voiceName),
    sourceVideoUrl: s(body.sourceVideoUrl) ?? null,
    assets: Array.isArray(body.assets) ? (body.assets as FilmAsset[]).slice(0, 40) : [],
  });
  return NextResponse.json({ success: true, data: { film } });
}
