import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkInviteToken } from "@/lib/training/access";
import { getTrainingActor } from "@/lib/training/guest";
import { addConn, removeConn, touchConn, broadcast, connectedIds } from "@/lib/training/room";
import { getSessionDTO, meterRoom } from "@/lib/training/session";
import type { RoomEvent } from "@/lib/training/types";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const deny = (message: string, status: number) =>
  new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } });

/**
 * GET — the live room stream.
 *
 * Read = SSE, write = POST elsewhere. Same shape as the Design Studio's collab
 * stream, which already survives our nginx (X-Accel-Buffering: no).
 *
 * A guest joins with ?invite=<token> and no account, exactly like a DesignShare
 * link. The first frame is a full snapshot, so a phone that reopens an hour
 * later lands on the truth rather than replaying events it missed.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const inviteToken = request.nextUrl.searchParams.get("invite");

  let participantId: string | null = null;

  // A logged-in user OR an anonymous guest (via the room cookie) is resolved here.
  const actor = await getTrainingActor(id);
  if (actor) participantId = actor.participantId;

  // No seat yet → try the join link (the direct ?invite path, still supported).
  if (!participantId && inviteToken) {
    const invite = await checkInviteToken(inviteToken);
    if (!invite || invite.sessionId !== id) return deny("That link isn't valid any more", 403);

    const p = await prisma.trainingParticipant.create({
      data: {
        sessionId: id,
        userId: session?.userId ?? null,
        name: session?.user.name || request.nextUrl.searchParams.get("name") || "Guest",
        email: session?.user.email ?? null,
        avatarUrl: session?.user.avatarUrl ?? null,
        role: invite.role === "COHOST" ? "COHOST" : session ? "TRAINEE" : "GUEST",
        // the waiting room is the whole point of the waiting room
        state: invite.waitingRoom && invite.role !== "COHOST" ? "WAITING" : "ADMITTED",
        canShare: invite.role === "COHOST",
        canDraw: invite.role === "COHOST",
        joinedAt: new Date(),
      },
      select: { id: true },
    });
    participantId = p.id;
    await prisma.trainingInvite.update({
      where: { id: invite.inviteId },
      data: { useCount: { increment: 1 } },
    });
  }

  if (!participantId) return deny("Unauthorized", 401);

  // Returning after a leave (or a dropped connection): put the seat back before
  // we snapshot, so the DTO includes them again. Hosts/co-hosts always return
  // to their seat; a trainee/guest re-knocks if the room has a waiting room.
  const existing = await prisma.trainingParticipant.findUnique({ where: { id: participantId }, select: { state: true, role: true } });
  if (existing?.state === "LEFT") {
    const room = await prisma.trainingSession.findUnique({ where: { id }, select: { waitingRoom: true } });
    const back = existing.role === "HOST" || existing.role === "COHOST" || !room?.waitingRoom ? "ADMITTED" : "WAITING";
    await prisma.trainingParticipant.update({ where: { id: participantId }, data: { state: back, leftAt: null } }).catch(() => {});
  }

  const dto = await getSessionDTO(id);
  if (!dto) return deny("No such room", 404);
  const me = dto.participants.find((p) => p.id === participantId);
  if (!me) return deny("Access denied", 403);

  const sessionKey = `${participantId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const encoder = new TextEncoder();
  const pid = participantId;

  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let meterTick: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      addConn(id, sessionKey, { participantId: pid, lastSeen: Date.now(), controller });

      const init: RoomEvent = { type: "room:init", sessionKey, me, session: dto };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(init)}\n\n`));

      // A knock notifies the hosts; a join notifies the room.
      broadcast(
        id,
        me.state === "WAITING" ? { type: "knock", participant: me } : { type: "room:join", participant: me },
        sessionKey,
      );

      heartbeat = setInterval(() => {
        try {
          touchConn(id, sessionKey);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`));
        } catch {
          if (heartbeat) clearInterval(heartbeat);
        }
      }, 15_000);

      // Bill the room from the HOST's connection only, so N attendees don't
      // each charge the tab N times. Incremental, so a room that never gets
      // "ended" is still paid for up to the last tick.
      if (me.role === "HOST") {
        meterTick = setInterval(() => {
          void (async () => {
            try {
              const live = connectedIds(id).length;
              if (live > 0) await meterRoom(id, live * 60);
            } catch {
              /* never let metering kill the stream */
            }
          })();
        }, 60_000);
      }
    },

    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (meterTick) clearInterval(meterTick);
      removeConn(id, sessionKey);
      // Once their LAST tab is gone they've left: mark the seat LEFT so a later
      // room:state re-broadcast can't resurrect them (a reconnect restores it).
      // updateMany guards on state so a removed/denied row is never touched.
      if (!connectedIds(id).includes(pid)) {
        void prisma.trainingParticipant
          .updateMany({ where: { id: pid, state: { in: ["ADMITTED", "WAITING"] } }, data: { state: "LEFT", leftAt: new Date() } })
          .catch(() => {});
        broadcast(id, { type: "room:leave", participantId: pid });
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: don't buffer the stream
    },
  });
}
