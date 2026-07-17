import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canManageRoles } from "@/lib/training/access";
import { estimateSession, getSessionDTO, meterRoom } from "@/lib/training/session";
import { checkCreditsAvailable } from "@/lib/credits/costs";
import { broadcast } from "@/lib/training/room";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST — start or end the room.
 *
 * Going live is gated on being able to afford the FIRST block, not the whole
 * session: the meter charges incrementally as the room runs, so demanding the
 * full estimate up front would refuse rooms the host can actually pay for.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canManageRoles({ role: access.role })) return err("Only the room owner can start or end the session", 403);

  const b = (await request.json().catch(() => ({}))) as { action?: "start" | "end" };

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { status: true, seats: true, plannedMins: true, recording: true, transcript: true, startedAt: true },
  });
  if (!room) return err("Not found", 404);

  if (b.action === "start") {
    if (room.status === "live") return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
    if (room.status === "ended") return err("This session has already finished");

    const est = await estimateSession({
      seats: room.seats,
      plannedMins: room.plannedMins,
      recording: room.recording,
      transcript: room.transcript,
    });

    // Need enough for the first 10-attendee-minute block plus any one-offs.
    const upfront = Math.max(1, est.recording + est.transcript + 1);
    const gate = await checkCreditsAvailable(session.userId, upfront, false, false);
    if (gate) return NextResponse.json({ success: false, error: gate }, { status: 402 });

    await prisma.trainingSession.update({
      where: { id },
      data: { status: "live", startedAt: room.startedAt ?? new Date() },
    });
    broadcast(id, { type: "room:state", patch: { status: "live" } });
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id), estimate: est } });
  }

  if (b.action === "end") {
    if (room.status !== "live") return err("That session isn't running");

    // Flush whatever time accrued since the last tick before closing the tab.
    await meterRoom(id, 0).catch(() => 0);

    await prisma.trainingSession.update({
      where: { id },
      data: { status: "ended", endedAt: new Date() },
    });
    await prisma.trainingParticipant.updateMany({
      where: { sessionId: id, leftAt: null },
      data: { leftAt: new Date(), sharing: false },
    });
    broadcast(id, { type: "room:state", patch: { status: "ended" } });
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
  }

  return err("Unknown action");
}
