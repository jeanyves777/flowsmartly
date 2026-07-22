import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isS3Configured, isS3Url, getPresignedDownloadUrl } from "@/lib/utils/s3-client";

const err = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });

/**
 * GET /api/ai/training/[id]/recording/download — one-click download of a session's recording.
 *
 * Redirects to a short-lived presigned URL that forces `Content-Disposition: attachment` with a
 * friendly filename, so the browser downloads the MP4 (cross-origin `download` on an <a> is
 * ignored otherwise). The object itself is untouched, so inline playback in the library still
 * works. Owner only. [[training-recording]]
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);

  const room = await prisma.trainingSession.findFirst({
    where: { id, userId: session.userId },
    select: { recordingUrl: true, title: true },
  });
  if (!room?.recordingUrl) return err("No recording for this session", 404);

  const filename = `${(room.title || "training").trim().slice(0, 60)}.mp4`;
  let url = room.recordingUrl;
  try {
    if (isS3Configured() && isS3Url(room.recordingUrl)) url = await getPresignedDownloadUrl(room.recordingUrl, filename);
  } catch {
    /* fall back to the raw url */
  }
  return NextResponse.redirect(url);
}
