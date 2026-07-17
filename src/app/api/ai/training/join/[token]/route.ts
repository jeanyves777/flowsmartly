import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkInviteToken } from "@/lib/training/access";
import type { ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET /api/ai/training/join/[token] — public.
 * What the join page shows before you commit: the session, who's hosting, and
 * how you're allowed in. Never leaks anything private.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await checkInviteToken(token);
  if (!invite) return err("This link isn't valid any more", 404);

  const s = await prisma.trainingSession.findUnique({
    where: { id: invite.sessionId },
    select: {
      title: true,
      status: true,
      access: true,
      seats: true,
      user: { select: { name: true } },
      _count: { select: { participants: { where: { state: "ADMITTED" } } } },
    },
  });
  if (!s) return err("This room no longer exists", 404);

  return NextResponse.json({
    success: true,
    data: {
      title: s.title,
      hostName: s.user?.name || "Your host",
      status: s.status,
      inRoom: s._count.participants,
      seats: s.seats,
      role: invite.role,
      waitingRoom: invite.waitingRoom,
      // an open room lets anyone in; otherwise you need an account
      guestAllowed: s.access === "open",
    },
  });
}

/**
 * POST /api/ai/training/join/[token].
 * A logged-in visitor joins: we ensure a participant row (idempotent), then hand
 * back the sessionId so the client opens the room. Not signed in → 401, and the
 * page routes them to log in and come back.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await checkInviteToken(token);
  if (!invite) return err("This link isn't valid any more", 404);

  const session = await getSession();
  if (!session) return err("Please log in to join", 401);

  const room = await prisma.trainingSession.findUnique({
    where: { id: invite.sessionId },
    select: { id: true, userId: true, seats: true, waitingRoom: true },
  });
  if (!room) return err("This room no longer exists", 404);

  // The owner is always the host — never re-seat them as a trainee.
  if (room.userId === session.userId) {
    return NextResponse.json({ success: true, data: { sessionId: room.id, state: "ADMITTED" } });
  }

  const existing = await prisma.trainingParticipant.findFirst({
    where: { sessionId: room.id, userId: session.userId },
    select: { id: true, state: true, role: true },
  });

  if (existing) {
    // Already invited/seated. A denied/removed person can't reuse the link.
    if (existing.state === "REMOVED" || existing.state === "DENIED") {
      return err("You can't rejoin this room", 403);
    }
    return NextResponse.json({ success: true, data: { sessionId: room.id, state: existing.state } });
  }

  const role: ParticipantRole = invite.role === "COHOST" ? "COHOST" : "TRAINEE";
  // Co-hosts skip the waiting room; a full room sends new joiners to wait.
  const seated = await prisma.trainingParticipant.count({ where: { sessionId: room.id, state: "ADMITTED" } });
  const state =
    role === "COHOST" ? "ADMITTED" : room.waitingRoom || seated >= room.seats ? "WAITING" : "ADMITTED";

  await prisma.trainingParticipant.create({
    data: {
      sessionId: room.id,
      userId: session.userId,
      name: session.user.name || session.user.email || "Guest",
      email: session.user.email ?? null,
      avatarUrl: session.user.avatarUrl ?? null,
      role,
      state,
      canShare: role === "COHOST",
      canDraw: role === "COHOST",
    },
  });
  await prisma.trainingInvite.update({ where: { id: invite.inviteId }, data: { useCount: { increment: 1 } } });

  return NextResponse.json({ success: true, data: { sessionId: room.id, state } });
}
