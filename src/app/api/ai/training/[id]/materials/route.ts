import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { uploadToS3 } from "@/lib/utils/s3-client";
import type { MaterialKind } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

const KINDS: MaterialKind[] = ["slides", "doc", "video", "image"];

// What the board can display, and the per-type ceiling.
const MATERIAL_LIMITS: Record<string, number> = {
  "image/png": 10 * 1024 * 1024,
  "image/jpeg": 10 * 1024 * 1024,
  "image/jpg": 10 * 1024 * 1024,
  "image/webp": 10 * 1024 * 1024,
  "image/gif": 10 * 1024 * 1024,
  "application/pdf": 25 * 1024 * 1024,
  "video/mp4": 100 * 1024 * 1024,
  "video/webm": 100 * 1024 * 1024,
  "video/quicktime": 100 * 1024 * 1024,
};

const kindFor = (mime: string): MaterialKind =>
  mime.startsWith("video/") ? "video" : mime.startsWith("image/") ? "image" : "doc";

// Allow up to this many materials per room.
const MAX_MATERIALS = 40;

/**
 * POST — add a material to the room.
 *
 * Two intake shapes:
 *  - multipart/form-data with a `file` → we upload it to S3 SERVER-SIDE via
 *    uploadToS3 (the path that actually works in prod; the presigned browser-PUT
 *    path 403s platform-wide on this bucket). This is what the studio UI uses.
 *  - application/json { name, kind, url, … } → attach a file that is already in
 *    S3 (used by the agent / library picks). We never re-upload those.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can add materials", 403);

  const count = await prisma.trainingMaterial.count({ where: { sessionId: id } });
  if (count >= MAX_MATERIALS) return err("That's the most materials a session can hold");

  const contentType = request.headers.get("content-type") || "";

  // ---- multipart: the browser hands us the bytes, we put them in S3 ----
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return err("No file");

    const limit = MATERIAL_LIMITS[file.type];
    if (!limit) return err("That file type isn't supported — use an image, a PDF or a video");
    if (file.size > limit) return err(`That file is too big (max ${Math.round(limit / 1024 / 1024)}MB)`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const safe = (file.name || "material").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const key = `training/${id}/${Date.now()}-${safe}`;
    const url = await uploadToS3(key, buffer, file.type);

    const media = await prisma.mediaFile.create({
      data: {
        userId: session.userId,
        filename: key.split("/").pop() || safe,
        originalName: file.name?.slice(0, 160) || "Material",
        url,
        type: kindFor(file.type) === "doc" ? "document" : kindFor(file.type),
        mimeType: file.type,
        size: file.size,
        tags: JSON.stringify(["training"]),
      },
      select: { id: true },
    }).catch(() => null);

    await prisma.trainingMaterial.create({
      data: {
        sessionId: id,
        name: file.name?.slice(0, 160) || "Material",
        kind: kindFor(file.type),
        url,
        pages: 1,
        sizeBytes: file.size,
        mediaFileId: media?.id ?? null,
      },
    });

    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
  }

  // ---- json: attach a file already in S3 ----
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
