import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canDraw, canControlRoom } from "@/lib/training/access";
import { parseBoard } from "@/lib/training/session";
import { broadcast } from "@/lib/training/room";
import type { BoardItem, ParticipantRole } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/** Cap the stored board so one enthusiastic session can't grow a row unbounded. */
const MAX_ITEMS = 4000;

/**
 * POST — a board write.
 *
 * The board is PRESENTER-AUTHORITATIVE: the server checks canDraw() on every
 * op, so a trainee who hasn't been handed the pen can't draw even if they
 * forge the request. That check is the whole reason we don't need a CRDT —
 * with one writer at a time, last-write-wins is correct rather than lossy.
 *
 * Ops are appended to the stored doc AND fanned out over SSE, so a late joiner
 * gets the board from the snapshot and everyone else gets it live.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { boardDoc: true, openDraw: true, penHolderId: true, status: true },
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
    select: { id: true, role: true, canDraw: true },
  });
  if (!me) return err("You're not in this room", 403);

  if (!canDraw({ id: me.id, role: me.role as ParticipantRole, canDraw: me.canDraw }, room)) {
    return err("You don't have the pen right now", 403);
  }

  const b = (await request.json().catch(() => ({}))) as {
    op?: "add" | "remove" | "clear" | "bg";
    item?: BoardItem;
    itemId?: string;
    bg?: "blank" | "grid" | "dark";
  };

  const doc = parseBoard(room.boardDoc);

  switch (b.op) {
    case "add": {
      if (!b.item?.id) return err("No item");
      // stamp authorship server-side — a client can't claim someone else drew it
      const item = { ...b.item, by: me.id } as BoardItem;
      doc.items.push(item);
      if (doc.items.length > MAX_ITEMS) doc.items.splice(0, doc.items.length - MAX_ITEMS);
      broadcast(id, { type: "board:add", item });
      break;
    }
    case "remove": {
      if (!b.itemId) return err("No itemId");
      const target = doc.items.find((i) => i.id === b.itemId);
      if (!target) return NextResponse.json({ success: true }); // already gone
      // you can undo your own marks; a host can undo anyone's
      if (target.by !== me.id && !canControlRoom({ role: me.role as ParticipantRole })) {
        return err("That isn't yours to remove", 403);
      }
      doc.items = doc.items.filter((i) => i.id !== b.itemId);
      broadcast(id, { type: "board:remove", itemId: b.itemId });
      break;
    }
    case "clear": {
      if (!canControlRoom({ role: me.role as ParticipantRole })) return err("Only a host can clear the board", 403);
      doc.items = [];
      broadcast(id, { type: "board:clear" });
      break;
    }
    case "bg": {
      if (!canControlRoom({ role: me.role as ParticipantRole })) return err("Only a host can change the board", 403);
      doc.bg = b.bg ?? "grid";
      break;
    }
    default:
      return err("Unknown op");
  }

  await prisma.trainingSession.update({
    where: { id },
    data: { boardDoc: JSON.stringify(doc) },
  });

  return NextResponse.json({ success: true });
}

/**
 * PUT — a cursor / laser ping. Never stored: it's pure presence, and writing it
 * to Postgres 20×/second per person would be absurd.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed) return err("Access denied", 403);

  const b = (await request.json().catch(() => ({}))) as {
    kind?: "cursor" | "laser";
    x?: number;
    y?: number;
    sessionKey?: string;
  };
  const meId =
    access.participantId ??
    (
      await prisma.trainingParticipant.findFirst({
        where: { sessionId: id, userId: session.userId },
        select: { id: true },
      })
    )?.id;
  if (!meId || typeof b.x !== "number" || typeof b.y !== "number") return err("Bad ping");

  broadcast(
    id,
    { type: b.kind === "laser" ? "laser" : "cursor", participantId: meId, x: b.x, y: b.y },
    b.sessionKey,
  );
  return NextResponse.json({ success: true });
}
