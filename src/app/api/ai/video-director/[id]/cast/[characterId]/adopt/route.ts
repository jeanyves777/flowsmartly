import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { getFilm } from "@/lib/video-director/store";
import { patchFilmCharacter } from "@/lib/video-director/cast";

/**
 * POST — REUSE an already-generated character from one of the user's other films
 * for this cast slot (for serial/franchise films). Body: { sourceId: "<filmId>:<charId>" }.
 * The source is read from the user's OWN film (auth-scoped) — we never trust a client
 * URL — and its identity (name/role/description/wardrobe + portrait + turnaround sheet)
 * is copied onto the slot, marked ready but NOT approved (the user still confirms it).
 * Free + instant: no regeneration, so the face is byte-for-byte the same across episodes.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const body = await request.json().catch(() => ({}));
  const sourceId = typeof body?.sourceId === "string" ? body.sourceId : "";
  const sep = sourceId.indexOf(":");
  const srcFilmId = sep > 0 ? sourceId.slice(0, sep) : "";
  const srcCharId = sep > 0 ? sourceId.slice(sep + 1) : "";
  if (!srcFilmId || !srcCharId) {
    return NextResponse.json({ success: false, error: { message: "Invalid source character." } }, { status: 400 });
  }

  const srcFilm = await getFilm(srcFilmId, session.userId);
  const src = srcFilm?.characters?.find((c) => c.id === srcCharId);
  if (!src?.referenceImageUrl) {
    return NextResponse.json({ success: false, error: { message: "That saved character could not be found." } }, { status: 404 });
  }

  const film = await patchFilmCharacter(id, session.userId, characterId, {
    name: src.name,
    role: src.role,
    description: src.description,
    renderStyle: src.renderStyle,
    wardrobe: src.wardrobe,
    referenceImageUrl: src.referenceImageUrl,
    characterSheetUrl: src.characterSheetUrl ?? null,
    previewStatus: "ready",
    previewError: null,
    approved: false,
  });
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const data = await presignAllUrls({ film });
  return NextResponse.json({ success: true, data });
}
