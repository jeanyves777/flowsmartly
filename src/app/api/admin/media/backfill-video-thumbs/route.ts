import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { uploadToS3 } from "@/lib/utils/s3-client";
import { findFFmpegPath } from "@/lib/cartoon/video-compositor";
import { randomUUID } from "crypto";
import { writeFile, unlink, mkdir, readFile } from "fs/promises";
import { spawn } from "child_process";
import path from "path";
import os from "os";

/**
 * POST /api/admin/media/backfill-video-thumbs
 *
 * One-shot backfill that generates ffmpeg thumbnails for existing MediaFile
 * rows where `type === "video"` and `metadata.thumbnailUrl` is missing.
 *
 * Auth: x-admin-secret header matching ADMIN_SECRET env.
 *
 * Body (optional JSON):
 *   { limit?: number = 50, dryRun?: boolean = false }
 *
 * Behavior per candidate:
 *  - Fetch the video bytes from `MediaFile.url` (S3, presigned, or otherwise)
 *  - Write to os.tmpdir(), spawn the same ffmpeg pattern used at upload time
 *    (`-y -i IN -vframes 1 -vf scale=640:-1 -q:v 2 OUT`)
 *  - Upload the JPG to `media/thumbs/${mediaFile.id}.jpg`
 *  - Merge thumbnailUrl into parsed metadata and persist back
 *  - try/catch per item so one bad video doesn't abort the batch
 *  - try/finally cleanup of every tmp file
 *
 * Notes:
 *  - We rely on `fetch(url).arrayBuffer()` — this buffers the whole video in
 *    memory before writing to disk, so for very large videos (~hundreds of MB)
 *    this will spike RSS. Acceptable for a one-shot run; if it ever needs to
 *    scale, swap to a streaming pipe to fs.createWriteStream.
 *  - If the URL is a presigned S3 URL that has already expired, `fetch` returns
 *    a 403 — we record that as `{ ok: false, error: "fetch failed: 403" }` and
 *    move on. Re-run after the row is touched so a fresh presigned URL is
 *    issued, OR adapt to call getPresignedUrl(url) here if we standardize on
 *    storing keys instead of full URLs.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("x-admin-secret");
  if (!authHeader || authHeader !== process.env.ADMIN_SECRET) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  // Parse optional body
  let limit = 50;
  let dryRun = false;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
      dryRun?: boolean;
    };
    if (typeof body.limit === "number" && Number.isFinite(body.limit) && body.limit > 0) {
      limit = Math.min(Math.floor(body.limit), 500);
    }
    if (typeof body.dryRun === "boolean") {
      dryRun = body.dryRun;
    }
  } catch {
    // No body / invalid JSON — use defaults
  }

  // Fetch videos most-recent-first, then filter in-app for missing thumbnailUrl
  const candidates = await prisma.mediaFile.findMany({
    where: { type: "video" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const needsThumb = candidates.filter((row) => {
    try {
      const meta = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
      return !meta || typeof meta.thumbnailUrl !== "string" || !meta.thumbnailUrl;
    } catch {
      // Unparseable metadata — treat as missing
      return true;
    }
  });

  const ffmpegPath = findFFmpegPath();
  if (!ffmpegPath && !dryRun) {
    return NextResponse.json(
      {
        success: false,
        error: { message: "FFmpeg not found on this host" },
      },
      { status: 500 }
    );
  }

  const tmpDir = path.join(os.tmpdir(), "flowsmartly-thumb-backfill");
  await mkdir(tmpDir, { recursive: true });

  const results: Array<{ id: string; ok: boolean; error?: string; thumbnailUrl?: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const row of needsThumb) {
    if (dryRun) {
      results.push({ id: row.id, ok: true });
      continue;
    }

    const workId = randomUUID().substring(0, 8);
    // Try to keep the input extension when we can — helps ffmpeg autodetect.
    const extFromFilename = (row.filename.split(".").pop() || "mp4").replace(/[^a-zA-Z0-9]/g, "").substring(0, 6) || "mp4";
    const inputPath = path.join(tmpDir, `in-${workId}.${extFromFilename}`);
    const outputPath = path.join(tmpDir, `out-${workId}.jpg`);

    try {
      // 1. Download video bytes
      const resp = await fetch(row.url);
      if (!resp.ok) {
        throw new Error(`fetch failed: ${resp.status}`);
      }
      const ab = await resp.arrayBuffer();
      await writeFile(inputPath, Buffer.from(ab));

      // 2. Spawn ffmpeg — same flags as the upload route
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(
          ffmpegPath!,
          [
            "-y",
            "-i", inputPath,
            "-vframes", "1",
            "-vf", "scale=640:-1",
            "-q:v", "2",
            outputPath,
          ],
          { windowsHide: true }
        );
        proc.on("error", reject);
        proc.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))
        );
      });

      const thumbBuffer = await readFile(outputPath);

      // 3. Upload to S3 at the canonical path
      const thumbKey = `media/thumbs/${row.id}.jpg`;
      const thumbUrl = await uploadToS3(thumbKey, thumbBuffer, "image/jpeg");

      // 4. Merge into existing metadata and persist
      let parsedMeta: Record<string, unknown> = {};
      try {
        parsedMeta = row.metadata
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : {};
        if (!parsedMeta || typeof parsedMeta !== "object") parsedMeta = {};
      } catch {
        parsedMeta = {};
      }
      const newMeta = { ...parsedMeta, thumbnailUrl: thumbUrl };

      await prisma.mediaFile.update({
        where: { id: row.id },
        data: { metadata: JSON.stringify(newMeta) },
      });

      succeeded++;
      results.push({ id: row.id, ok: true, thumbnailUrl: thumbUrl });
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[backfill-video-thumbs] ${row.id} failed:`, message);
      results.push({ id: row.id, ok: false, error: message });
    } finally {
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: needsThumb.length,
      succeeded,
      failed,
      dryRun,
      results,
    },
  });
}
