import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { SEGMENT_KINDS, type SegmentKind } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

async function guard(id: string) {
  const session = await getSession();
  if (!session) return { bad: err("Unauthorized", 401) };
  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return { bad: err("Access denied", 403) };
  if (!canControlRoom({ role: access.role })) return { bad: err("Only a host can change the plan", 403) };
  return { ok: true as const };
}

/** Runtime always follows the agenda — recompute it, never accept a client total. */
async function syncRuntime(sessionId: string) {
  const segs = await prisma.trainingSegment.findMany({
    where: { sessionId },
    select: { durationMins: true },
  });
  const plannedMins = segs.reduce((m, s) => m + s.durationMins, 0);
  await prisma.trainingSession.update({ where: { id: sessionId }, data: { plannedMins } });
}

/** POST — add a segment to the plan. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.bad) return g.bad;

  const b = (await request.json().catch(() => ({}))) as {
    kind?: SegmentKind;
    title?: string;
    durationMins?: number;
    x?: number;
    y?: number;
  };
  const kind = (b.kind && SEGMENT_KINDS[b.kind] ? b.kind : "board") as SegmentKind;
  const meta = SEGMENT_KINDS[kind];

  const count = await prisma.trainingSegment.count({ where: { sessionId: id } });
  if (count >= 24) return err("That's the most segments a session can hold");

  const last = await prisma.trainingSegment.findFirst({
    where: { sessionId: id },
    orderBy: { x: "desc" },
    select: { x: true },
  });

  await prisma.trainingSegment.create({
    data: {
      sessionId: id,
      kind,
      title: (b.title || meta.label).slice(0, 120),
      note: meta.note,
      durationMins: b.durationMins ?? meta.mins,
      order: count,
      x: b.x ?? (last?.x ?? 534) + 266,
      y: b.y ?? 150,
      ready: false,
    },
  });

  await syncRuntime(id);
  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}

/**
 * PATCH — bulk update segments. The canvas sends the whole set after a drag so
 * order can be re-derived from x (left→right = session order), exactly like the
 * Director re-sequences scenes.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.bad) return g.bad;

  const b = (await request.json().catch(() => ({}))) as {
    segments?: { id: string; title?: string; note?: string; durationMins?: number; x?: number; y?: number; ready?: boolean; materialId?: string | null }[];
  };
  if (!b.segments?.length) return err("No segments");

  const mine = await prisma.trainingSegment.findMany({
    where: { sessionId: id, id: { in: b.segments.map((s) => s.id) } },
    select: { id: true },
  });
  const allowed = new Set(mine.map((m) => m.id));

  const ordered = [...b.segments].filter((s) => allowed.has(s.id)).sort((a, z) => (a.x ?? 0) - (z.x ?? 0));

  await prisma.$transaction(
    ordered.map((s, i) =>
      prisma.trainingSegment.update({
        where: { id: s.id },
        data: {
          order: i,
          ...(s.title !== undefined ? { title: s.title.slice(0, 120) } : {}),
          ...(s.note !== undefined ? { note: s.note } : {}),
          ...(s.durationMins !== undefined ? { durationMins: Math.min(240, Math.max(1, s.durationMins)) } : {}),
          ...(s.x !== undefined ? { x: Math.max(0, Math.round(s.x)) } : {}),
          ...(s.y !== undefined ? { y: Math.max(0, Math.round(s.y)) } : {}),
          ...(s.ready !== undefined ? { ready: s.ready } : {}),
          ...(s.materialId !== undefined ? { materialId: s.materialId } : {}),
        },
      }),
    ),
  );

  await syncRuntime(id);
  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}

/** DELETE — remove one segment (?segmentId=...). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.bad) return g.bad;

  const segmentId = request.nextUrl.searchParams.get("segmentId");
  if (!segmentId) return err("No segmentId");

  const seg = await prisma.trainingSegment.findFirst({ where: { id: segmentId, sessionId: id }, select: { id: true } });
  if (!seg) return err("Not found", 404);

  await prisma.trainingSegment.delete({ where: { id: segmentId } });
  await syncRuntime(id);
  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}
