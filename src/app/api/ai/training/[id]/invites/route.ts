import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom, canManageRoles } from "@/lib/training/access";
import { getSessionDTO, newToken } from "@/lib/training/session";
import type { ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST — invite people. A COHOST invite is owner-only: a co-host must not be
 * able to mint more co-hosts.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can invite people", 403);

  const b = (await request.json().catch(() => ({}))) as {
    emails?: string[];
    role?: ParticipantRole;
    label?: string;
    maxUses?: number | null;
    expiresAt?: string | null;
  };

  const role: ParticipantRole = b.role === "COHOST" ? "COHOST" : b.role === "GUEST" ? "GUEST" : "TRAINEE";
  if (role === "COHOST" && !canManageRoles({ role: access.role })) {
    return err("Only the room owner can invite a co-host", 403);
  }

  const emails = (b.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean).slice(0, 50);

  // No emails = mint a shareable link.
  if (!emails.length) {
    await prisma.trainingInvite.create({
      data: {
        sessionId: id,
        token: newToken(),
        role,
        label: b.label?.slice(0, 80) ?? "Join link",
        maxUses: b.maxUses ?? null,
        expiresAt: b.expiresAt ? new Date(b.expiresAt) : null,
        createdBy: session.userId,
      },
    });
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
  }

  // Seat known users straight away; unknown emails get a link to claim.
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  const existing = await prisma.trainingParticipant.findMany({
    where: { sessionId: id, email: { in: emails } },
    select: { email: true },
  });
  const already = new Set(existing.map((e) => (e.email || "").toLowerCase()));

  const room = await prisma.trainingSession.findUnique({ where: { id }, select: { waitingRoom: true } });
  const state = role === "COHOST" || !room?.waitingRoom ? "ADMITTED" : "WAITING";

  const fresh = emails.filter((e) => !already.has(e));
  if (fresh.length) {
    const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
    await prisma.trainingParticipant.createMany({
      data: fresh.map((e) => {
        const u = byEmail.get(e);
        return {
          sessionId: id,
          userId: u?.id ?? null,
          name: u?.name || e.split("@")[0],
          email: e,
          avatarUrl: u?.avatarUrl ?? null,
          role,
          state,
          canShare: role === "COHOST",
          canDraw: role === "COHOST",
        };
      }),
    });
    await prisma.trainingInvite.createMany({
      data: fresh.map((e) => ({
        sessionId: id,
        token: newToken(),
        email: e,
        role,
        label: b.label?.slice(0, 80) ?? null,
        createdBy: session.userId,
        sentAt: new Date(),
      })),
    });
  }

  return NextResponse.json({
    success: true,
    data: { session: await getSessionDTO(id), invited: fresh.length, skipped: emails.length - fresh.length },
  });
}

/** DELETE — kill a link (?inviteId=...). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can do that", 403);

  const inviteId = request.nextUrl.searchParams.get("inviteId");
  if (!inviteId) return err("No inviteId");

  const inv = await prisma.trainingInvite.findFirst({ where: { id: inviteId, sessionId: id }, select: { id: true } });
  if (!inv) return err("Not found", 404);

  await prisma.trainingInvite.update({ where: { id: inviteId }, data: { isActive: false } });
  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}
