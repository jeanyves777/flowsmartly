import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canShareScreen } from "@/lib/training/access";
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
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed) return err(access.waiting ? "You're still in the waiting room" : "Access denied", 403);

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { openShare: true, status: true },
  });
  if (!room) return err("Not found", 404);

  const meId =
    access.participantId ??
    (
      await prisma.trainingParticipant.findFirst({
        where: { sessionId: id, userId: session.userId },
        select: { id: true },
      })
    )?.id;
  if (!meId) return err("You're not in this room", 403);

  const me = await prisma.trainingParticipant.findUnique({
    where: { id: meId },
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
