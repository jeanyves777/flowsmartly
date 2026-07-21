import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { verifyRecorderToken } from "@/lib/training/recorder";
import { broadcast } from "@/lib/training/room";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST /api/ai/training/[id]/recording — the recorder bot REGISTERS a finished recording.
 *
 * The bot uploads the file to S3 itself (media-box creds) and calls this with the public
 * URL. Auth is the recorder ticket (audience "recorder", scoped to this session) — NOT a
 * user session, since the bot has no account. Sets the session's recordingUrl so it shows
 * up in the owner's recordings library. [[training-studio]]
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { url?: string; token?: string };

  if (!(await verifyRecorderToken(body.token, id))) return err("Unauthorized", 401);
  if (!body.url || !/^https?:\/\/\S+$/.test(body.url)) return err("A recording url is required");

  const room = await prisma.trainingSession.findUnique({ where: { id }, select: { id: true } });
  if (!room) return err("That session no longer exists", 404);

  await prisma.trainingSession.update({ where: { id }, data: { recordingUrl: body.url } });

  // Let anyone still in the room know the recording is ready.
  broadcast(id, { type: "room:state", patch: { recordingUrl: body.url } });

  return NextResponse.json({ success: true });
}
