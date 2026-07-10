import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { patchFilmCharacter } from "@/lib/video-director/cast";
import type { FilmCharacter } from "@/lib/video-director/types";

/**
 * PATCH — approve a character or edit its name/role/description (free).
 * To (re)generate images or attach an uploaded photo, use the /preview route.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; characterId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id, characterId } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Partial<FilmCharacter> = {};
  if (typeof body?.approved === "boolean") patch.approved = body.approved;
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.role === "string") patch.role = body.role;
  if (typeof body?.description === "string") patch.description = body.description;

  const film = await patchFilmCharacter(id, session.userId, characterId, patch);
  if (!film) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 });
  const data = await presignAllUrls({ film });
  return NextResponse.json({ success: true, data });
}
