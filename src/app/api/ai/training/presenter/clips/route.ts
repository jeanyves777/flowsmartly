import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { parseDeck } from "@/lib/training/deck";

const err = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });

/**
 * The user's REUSABLE presenter-film library (intro / outro clips they already generated).
 * GET  ?kind=intro|outro&materialId=… → the saved clips, newest first, each flagged `sameVoice`
 *   when its baked voice matches the deck's current presenter voice (only those are safe to reuse
 *   verbatim). DELETE ?id=… removes one from the library. [[training-presenter-talking-video]]
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  const materialId = searchParams.get("materialId");

  // The voice the current deck speaks in — a clip is only a verbatim match when it shares it.
  let curVoice: string | null = null;
  if (materialId) {
    const mat = await prisma.trainingMaterial.findFirst({ where: { id: materialId, session: { userId: session.userId } }, select: { deck: true } });
    if (mat?.deck) {
      const presenterId = parseDeck(mat.deck).presenterId;
      if (presenterId) {
        const p = await prisma.presenterProfile.findFirst({ where: { id: presenterId, userId: session.userId }, select: { voiceProfileId: true } });
        curVoice = p?.voiceProfileId ?? null;
      }
    }
  }

  const clips = await prisma.presenterClip.findMany({
    where: { userId: session.userId, ...(kind === "intro" || kind === "outro" ? { kind } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  return NextResponse.json({
    success: true,
    data: {
      clips: clips.map((c) => ({
        id: c.id,
        kind: c.kind,
        videoUrl: c.videoUrl,
        thumbnailUrl: c.thumbnailUrl,
        presenterName: c.presenterName,
        script: c.script,
        durationMs: c.durationMs,
        createdAt: c.createdAt.toISOString(),
        sameVoice: !!curVoice && c.voiceProfileId === curVoice,
      })),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Nothing to delete");
  await prisma.presenterClip.deleteMany({ where: { id, userId: session.userId } });
  return NextResponse.json({ success: true });
}
