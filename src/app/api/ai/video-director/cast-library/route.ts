import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { presignAllUrls } from "@/lib/utils/s3-client";
import { listCastLibrary } from "@/lib/video-director/store";

/**
 * GET — the user's reusable CAST across all their films, so a serial/franchise can
 * reuse the SAME characters in a new episode instead of regenerating them.
 * `?exclude=<filmId>` drops the current film's own cast from the list.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const exclude = request.nextUrl.searchParams.get("exclude") || undefined;
  const cast = await listCastLibrary(session.userId, { excludeFilmId: exclude });
  const data = await presignAllUrls({ cast }); // presign portrait/sheet for display; sourceId stays as-is
  return NextResponse.json({ success: true, data });
}
