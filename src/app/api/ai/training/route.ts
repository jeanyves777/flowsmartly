import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { autoTitle, getSessionDTO, newToken } from "@/lib/training/session";
import { SEGMENT_KINDS, type SegmentKind, type SessionType, type AccessMode } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/** GET — the host's sessions, newest first (the Sessions drawer). */
export async function GET() {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const rows = await prisma.trainingSession.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: {
      id: true,
      title: true,
      status: true,
      sessionType: true,
      seats: true,
      plannedMins: true,
      startsAt: true,
      startedAt: true,
      endedAt: true,
      recordingUrl: true,
      creditsSpent: true,
      _count: { select: { participants: true, segments: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      sessions: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        sessionType: r.sessionType,
        seats: r.seats,
        plannedMins: r.plannedMins,
        startsAt: r.startsAt?.toISOString() ?? null,
        startedAt: r.startedAt?.toISOString() ?? null,
        endedAt: r.endedAt?.toISOString() ?? null,
        recordingUrl: r.recordingUrl,
        creditsSpent: r.creditsSpent,
        participantCount: r._count.participants,
        segmentCount: r._count.segments,
      })),
    },
  });
}

interface CreateBody {
  brief?: string;
  title?: string;
  sessionType?: SessionType;
  seats?: number;
  plannedMins?: number;
  access?: AccessMode;
  startsAt?: string | null;
  recording?: boolean;
  transcript?: boolean;
  openDraw?: boolean;
  openShare?: boolean;
  waitingRoom?: boolean;
  boardBg?: "blank" | "grid" | "dark";
  /** the agenda the brief collected — becomes the segment nodes */
  segments?: { kind: SegmentKind; title?: string; durationMins?: number }[];
  /** emails to seat as co-hosts up front */
  cohostEmails?: string[];
}

/** POST — build a room from a brief. Creates the segments, the owner's HOST row
 *  and a join link in one go, so the canvas has something to draw immediately. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const body = (await request.json().catch(() => ({}))) as CreateBody;
  const brief = (body.brief || "").trim();
  const seats = Math.min(200, Math.max(1, body.seats ?? 12));

  const segs = (body.segments?.length ? body.segments : [{ kind: "board" as SegmentKind }]).slice(0, 24);
  // Runtime is DERIVED from the agenda — never trust a client-sent total.
  const plannedMins = segs.reduce((m, s) => m + (s.durationMins ?? SEGMENT_KINDS[s.kind]?.mins ?? 10), 0);

  const created = await prisma.trainingSession.create({
    data: {
      userId: session.userId,
      title: (body.title || autoTitle(brief)).slice(0, 120),
      brief,
      sessionType: body.sessionType ?? "training",
      status: body.startsAt ? "scheduled" : "draft",
      seats,
      plannedMins: plannedMins || (body.plannedMins ?? 45),
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      access: body.access ?? "invite",
      waitingRoom: body.waitingRoom ?? true,
      recording: body.recording ?? true,
      transcript: body.transcript ?? true,
      openDraw: body.openDraw ?? false,
      openShare: body.openShare ?? false,
      boardDoc: JSON.stringify({ v: 1, bg: body.boardBg ?? "grid", items: [] }),
      segments: {
        create: segs.map((s, i) => {
          const meta = SEGMENT_KINDS[s.kind] ?? SEGMENT_KINDS.board;
          return {
            kind: s.kind,
            title: (s.title || meta.label).slice(0, 120),
            note: meta.note,
            durationMins: s.durationMins ?? meta.mins,
            order: i,
            // seed the canvas in a staggered row, like the Director's layout
            x: 534 + i * 266,
            y: i % 2 === 0 ? 70 : 140,
            ready: false,
          };
        }),
      },
      participants: {
        create: {
          userId: session.userId,
          name: session.user.name || session.user.email || "Host",
          email: session.user.email ?? null,
          avatarUrl: session.user.avatarUrl ?? null,
          role: "HOST",
          state: "ADMITTED",
          canShare: true,
          canDraw: true,
          joinedAt: new Date(),
        },
      },
      invites: {
        create: {
          token: newToken(),
          role: "TRAINEE",
          label: "Join link",
          createdBy: session.userId,
        },
      },
    },
    select: { id: true, participants: { select: { id: true } } },
  });

  // The owner holds the pen from the start — the board is presenter-authoritative.
  const hostId = created.participants[0]?.id;
  if (hostId) {
    await prisma.trainingSession.update({
      where: { id: created.id },
      data: { penHolderId: hostId },
    });
  }

  // Seat any co-hosts named in the brief so they can help from minute zero.
  const emails = (body.cohostEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  if (emails.length) {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    const known = new Set(users.map((u) => u.email.toLowerCase()));
    await prisma.trainingParticipant.createMany({
      data: [
        ...users.map((u) => ({
          sessionId: created.id,
          userId: u.id,
          name: u.name || u.email,
          email: u.email,
          avatarUrl: u.avatarUrl,
          role: "COHOST",
          state: "ADMITTED",
          canShare: true,
          canDraw: true,
        })),
        // an email we don't have an account for still gets a seat + an invite
        ...emails
          .filter((e) => !known.has(e))
          .map((e) => ({
            sessionId: created.id,
            name: e.split("@")[0],
            email: e,
            role: "COHOST",
            state: "WAITING",
            canShare: true,
            canDraw: true,
          })),
      ],
    });
    await prisma.trainingInvite.createMany({
      data: emails.map((e) => ({
        sessionId: created.id,
        token: newToken(),
        email: e,
        role: "COHOST",
        label: "Co-host invite",
        createdBy: session.userId,
      })),
    });
  }

  const dto = await getSessionDTO(created.id);
  return NextResponse.json({ success: true, data: { session: dto } });
}
