import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { publishFilm, isFilmChannel, type FilmChannelId } from "@/lib/video-director/publish";

/**
 * POST /api/ai/video-director/[id]/publish — post or schedule the final stitched
 * film to the user's connected channels. Body: { channels: string[], caption?, scheduleAt? }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const channels = (Array.isArray(body.channels) ? body.channels : [])
    .map((c: unknown) => String(c)).filter(isFilmChannel) as FilmChannelId[];
  if (!channels.length) {
    return NextResponse.json({ success: false, error: { message: "Pick at least one channel to publish to." } }, { status: 400 });
  }
  const parsed = typeof body.scheduleAt === "string" ? new Date(body.scheduleAt) : null;
  const scheduledAt = parsed && !isNaN(parsed.getTime()) && parsed.getTime() > Date.now() ? parsed : null;
  const caption = typeof body.caption === "string" ? body.caption : undefined;

  const res = await publishFilm({ userId: session.userId, filmId: id, channels, caption, scheduledAt });
  if (!res.ok) return NextResponse.json({ success: false, error: { message: res.message } }, { status: 400 });
  return NextResponse.json({ success: true, data: { outcomes: res.outcomes } });
}
