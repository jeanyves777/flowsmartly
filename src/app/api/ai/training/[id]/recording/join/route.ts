import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyRecorderToken } from "@/lib/training/recorder";
import { mintGuestToken } from "@/lib/training/guest";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST /api/ai/training/[id]/recording/join — seat the RECORDING BOT.
 *
 * The bot authenticates with a recorder ticket (audience "recorder"), gets a hidden,
 * ADMITTED `isRecorder` participant on the session, and receives a guest token it sets as
 * the room cookie so it can load /m/[id] and render the real room to screen-record. The
 * bot is filtered out of the roster/tiles/count and never billed. Idempotent — a reconnect
 * reuses the same seat. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = (await request.json().catch(() => ({}))) as { token?: string };

  if (!(await verifyRecorderToken(token, id))) return err("Unauthorized", 401);

  const room = await prisma.trainingSession.findUnique({ where: { id }, select: { id: true } });
  if (!room) return err("That session no longer exists", 404);

  let bot = await prisma.trainingParticipant.findFirst({
    where: { sessionId: id, isRecorder: true },
    select: { id: true },
  });
  if (bot) {
    // reuse the seat, make sure it's admitted + present
    await prisma.trainingParticipant.update({ where: { id: bot.id }, data: { state: "ADMITTED", leftAt: null } });
  } else {
    bot = await prisma.trainingParticipant.create({
      data: {
        sessionId: id,
        name: "Recording",
        role: "GUEST",
        state: "ADMITTED",
        isRecorder: true,
        canShare: false,
        canDraw: false,
        joinedAt: new Date(),
      },
      select: { id: true },
    });
  }

  const guestToken = await mintGuestToken(id, bot.id);
  return NextResponse.json({ success: true, data: { participantId: bot.id, guestToken } });
}
