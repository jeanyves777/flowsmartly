import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { canShareScreen } from "@/lib/training/access";
import { getTrainingActor } from "@/lib/training/guest";
import { mintSfuToken } from "@/lib/training/sfu";
import type { ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST — a ticket to join this room's media.
 *
 * Re-checks the share right at mint time and bakes it into the token, so the SFU
 * enforces what the app decided. Returns { enabled: false } — not an error —
 * when no media server is configured, because a room with no video is a
 * perfectly usable whiteboard session, not a failure.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getTrainingActor(id);
  if (!actor) return err("Access denied", 403);
  if (actor.state !== "ADMITTED") return err("You're still in the waiting room", 403);

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { openShare: true, status: true },
  });
  if (!room) return err("Not found", 404);

  const me = await prisma.trainingParticipant.findUnique({
    where: { id: actor.participantId },
    select: { id: true, role: true, canShare: true },
  });
  if (!me) return err("You're not in this room", 403);

  const grant = await mintSfuToken({
    sessionId: id,
    participantId: me.id,
    canShare: canShareScreen({ role: me.role as ParticipantRole, canShare: me.canShare }, room),
  });

  return NextResponse.json({ success: true, data: { ...grant, participantId: me.id } });
}
