import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkInviteToken } from "@/lib/training/access";
import { mintGuestToken, guestCookieName, getTrainingActor } from "@/lib/training/guest";
import { brandColorList } from "@/lib/training/session";
import type { ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET /api/ai/training/join/[token] — public.
 * What the join page shows before you commit: the session, who's hosting, the
 * host's branding, and what to collect. Never leaks anything private.
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
      startsAt: true,
      access: true,
      seats: true,
      joinHeadline: true,
      joinMessage: true,
      joinLogoUrl: true,
      joinBannerUrl: true,
      joinCollectEmail: true,
      user: { select: { name: true, brandKits: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], take: 1, select: { logo: true, iconLogo: true, colors: true } } } },
      _count: { select: { participants: { where: { state: "ADMITTED" } } } },
    },
  });
  if (!s) return err("This room no longer exists", 404);

  const brandLogo = s.user?.brandKits?.[0]?.logo || s.user?.brandKits?.[0]?.iconLogo || null;

  return NextResponse.json({
    success: true,
    data: {
      title: s.title,
      hostName: s.user?.name || "Your host",
      status: s.status,
      startsAt: s.startsAt?.toISOString() ?? null,
      inRoom: s._count.participants,
      seats: s.seats,
      role: invite.role,
      waitingRoom: invite.waitingRoom,
      // The invite link IS the grant — anyone holding it joins as a guest with just
      // their name + email. No account, no login, on every room. The host still
      // controls entry from the waiting room.
      guestAllowed: true,
      collectEmail: true,
      headline: s.joinHeadline,
      message: s.joinMessage,
      logoUrl: s.joinLogoUrl || brandLogo, // uploaded override, else the Brand Kit logo
      bannerUrl: s.joinBannerUrl,
      brandColors: brandColorList(s.user?.brandKits?.[0]?.colors),
    },
  });
}

/**
 * POST /api/ai/training/join/[token].
 *
 * Logged-in → ensure a participant row (idempotent) and return the sessionId.
 * Anonymous with a name → create a GUEST participant and set a room-scoped guest
 * cookie so every training route can authenticate them without an account.
 * Invite-only rooms still require login (401).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await checkInviteToken(token);
  if (!invite) return err("This link isn't valid any more", 404);

  const room = await prisma.trainingSession.findUnique({
    where: { id: invite.sessionId },
    select: { id: true, userId: true, seats: true, waitingRoom: true, access: true, joinCollectEmail: true },
  });
  if (!room) return err("This room no longer exists", 404);

  const session = await getSession();

  // ---- logged-in ----
  if (session) {
    if (room.userId === session.userId) {
      return NextResponse.json({ success: true, data: { sessionId: room.id, state: "ADMITTED" } });
    }
    const existing = await prisma.trainingParticipant.findFirst({
      where: { sessionId: room.id, userId: session.userId },
      select: { id: true, state: true },
    });
    if (existing) {
      if (existing.state === "REMOVED" || existing.state === "DENIED") return err("You can't rejoin this room", 403);
      return NextResponse.json({ success: true, data: { sessionId: room.id, state: existing.state } });
    }
    const role: ParticipantRole = invite.role === "COHOST" ? "COHOST" : "TRAINEE";
    const seated = await prisma.trainingParticipant.count({ where: { sessionId: room.id, state: "ADMITTED" } });
    const state = role === "COHOST" ? "ADMITTED" : room.waitingRoom || seated >= room.seats ? "WAITING" : "ADMITTED";
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

  // ---- anonymous guest ----
  // No login on any room: the invite link is the grant. The host still gates
  // entry through the waiting room. Name + email are always required.

  // A guest who resubmits (reload, double-tap, re-enter their name) already holds
  // this room's cookie — reuse that seat instead of stacking a second WAITING
  // row that would leave a lingering "waiting to join" prompt after admitting.
  const existing = await getTrainingActor(room.id);
  if (existing?.isGuest && (existing.state === "WAITING" || existing.state === "ADMITTED")) {
    return NextResponse.json({ success: true, data: { sessionId: room.id, state: existing.state, guest: true } });
  }

  const body = (await request.json().catch(() => ({}))) as { name?: string; email?: string };
  const name = (body.name || "").trim().slice(0, 80);
  const email = (body.email || "").trim().toLowerCase().slice(0, 160);
  if (!name) return err("Please enter your name");
  if (!email || !email.includes("@")) return err("Please enter a valid email");

  const seated = await prisma.trainingParticipant.count({ where: { sessionId: room.id, state: "ADMITTED" } });
  const state = room.waitingRoom || seated >= room.seats ? "WAITING" : "ADMITTED";

  const guest = await prisma.trainingParticipant.create({
    data: {
      sessionId: room.id,
      userId: null,
      name,
      email: email || null,
      role: "GUEST",
      state,
      canShare: false,
      canDraw: false,
    },
    select: { id: true },
  });
  await prisma.trainingInvite.update({ where: { id: invite.inviteId }, data: { useCount: { increment: 1 } } });

  const guestToken = await mintGuestToken(room.id, guest.id);
  const res = NextResponse.json({ success: true, data: { sessionId: room.id, state, guest: true } });
  res.cookies.set(guestCookieName(room.id), guestToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 60 * 60,
  });
  return res;
}
