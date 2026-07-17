import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import type { MaterialKind } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

const KINDS: MaterialKind[] = ["slides", "doc", "video", "image"];

/**
 * POST — attach a material to the room.
 *
 * The bytes are already in S3 by now: the client uploads straight there with a
 * presigned URL from /api/media/upload-url (100MB video ceiling, already
 * configured), and hands us the resulting URL. We never proxy the file.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can add materials", 403);

  const b = (await request.json().catch(() => ({}))) as {
    name?: string;
    kind?: MaterialKind;
    url?: string;
    pages?: number;
    sizeBytes?: number;
    mediaFileId?: string;
  };
  if (!b.url) return err("No file");
  if (!b.name) return err("No name");

  const count = await prisma.trainingMaterial.count({ where: { sessionId: id } });
  if (count >= 40) return err("That's the most materials a session can hold");

  await prisma.trainingMaterial.create({
    data: {
      sessionId: id,
      name: b.name.slice(0, 160),
      kind: b.kind && KINDS.includes(b.kind) ? b.kind : "doc",
      url: b.url,
      pages: Math.max(1, b.pages ?? 1),
      sizeBytes: Math.max(0, b.sizeBytes ?? 0),
      mediaFileId: b.mediaFileId ?? null,
    },
  });

  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}

/** DELETE — detach a material (?materialId=...). */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can do that", 403);

  const materialId = request.nextUrl.searchParams.get("materialId");
  if (!materialId) return err("No materialId");

  const m = await prisma.trainingMaterial.findFirst({ where: { id: materialId, sessionId: id }, select: { id: true } });
  if (!m) return err("Not found", 404);

  await prisma.trainingMaterial.delete({ where: { id: materialId } });
  // any segment pointing at it loses its backing file, so it isn't "ready" any more
  await prisma.trainingSegment.updateMany({
    where: { sessionId: id, materialId },
    data: { materialId: null, ready: false },
  });
  // and if it was on the stage, the stage falls back to the board
  await prisma.trainingSession.updateMany({
    where: { id, stageKey: materialId },
    data: { stageSource: "board", stageKey: null },
  });

  return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
}
