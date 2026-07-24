import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { parseDeck } from "@/lib/training/deck";

export const runtime = "nodejs";
export const maxDuration = 60;

const err = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET /api/ai/training/[id]/narration/download?materialId=…[&slideId=…]
 * Streams the deck's baked voiceover as a single downloadable file — the WHOLE narration
 * (every voiced slide, in order, MP3 frames concatenated) or one slide's segment. Admin/preview
 * control: audit the full voiceover offline. [[training-presenter-talking-video]]
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const materialId = searchParams.get("materialId") || "";
  const slideId = searchParams.get("slideId");

  const mat = await prisma.trainingMaterial.findFirst({
    where: { id: materialId, session: { id, userId: session.userId } },
    select: { deck: true },
  });
  if (!mat?.deck) return err("That deck no longer exists", 404);
  const deck = parseDeck(mat.deck);

  // The voiceover, in play order: every slide that has a baked narration MP3. (Intro / moment /
  // outro / co-host slides carry their audio inside a video, not a separate track — skipped.)
  const segments = deck.slides
    .filter((s) => s.narration?.audioUrl && (!slideId || s.id === slideId))
    .map((s) => ({ id: s.id, url: s.narration!.audioUrl as string, title: s.title }));

  if (!segments.length) return err(slideId ? "That slide has no narration yet" : "No narration has been generated yet", 404);

  // Fetch each public MP3 server-side (these are public, immutable S3 URLs — not presigned).
  const buffers: Buffer[] = [];
  for (const seg of segments) {
    try {
      const res = await fetch(seg.url);
      if (!res.ok) continue;
      buffers.push(Buffer.from(await res.arrayBuffer()));
    } catch {
      /* skip a segment that won't load rather than fail the whole download */
    }
  }
  if (!buffers.length) return err("Couldn't load the narration audio — try again", 502);

  // MP3 frames are self-syncing, so a byte-concat of same-encoder segments plays as one track.
  const body = Buffer.concat(buffers);
  const name = slideId ? `narration-slide.mp3` : `narration-${deck.slides[0]?.id ? "full" : id}.mp3`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(body.length),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
