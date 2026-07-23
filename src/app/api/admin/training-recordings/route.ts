/**
 * Admin — Training Room recordings + recorder-bot control.
 *
 * GET  → recorder service health (the headless-Chrome bot), platform recording totals, and every
 *        recorded session (owner, length, watch/download).
 * POST → { action: "selftest" }  run the recorder's end-to-end pipeline self-test (records a test
 *                                 clip → S3) so you can verify the box without a live room.
 *        { action: "stop", sessionId } force-stop + finalize a stuck recording.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { auditAdmin } from "@/lib/audit/logger";
import { prisma } from "@/lib/db/client";
import { recorderHealth, recorderSelfTest, stopRoomRecording } from "@/lib/training/recorder";

const fail = (message: string, status = 400) => NextResponse.json({ success: false, error: { message } }, { status });

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);

  const [health, rows, recordedCount, liveCount] = await Promise.all([
    recorderHealth(),
    prisma.trainingSession.findMany({
      where: { recordingUrl: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 80,
      select: {
        id: true, title: true, status: true, plannedMins: true, seats: true,
        startedAt: true, endedAt: true, recordingUrl: true, creditsSpent: true,
        user: { select: { email: true, name: true } },
        _count: { select: { participants: true } },
      },
    }),
    prisma.trainingSession.count({ where: { recordingUrl: { not: null } } }),
    prisma.trainingSession.count({ where: { status: "live", recording: true } }),
  ]);

  const recordings = rows.map((r) => ({
    id: r.id, title: r.title, status: r.status, plannedMins: r.plannedMins, seats: r.seats,
    startedAt: r.startedAt?.toISOString() ?? null, endedAt: r.endedAt?.toISOString() ?? null,
    recordingUrl: r.recordingUrl, creditsSpent: r.creditsSpent,
    participantCount: r._count.participants,
    ownerEmail: r.user?.email ?? null, ownerName: r.user?.name ?? null,
    durationMins: r.startedAt && r.endedAt ? Math.max(1, Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 60000)) : r.plannedMins,
  }));

  return NextResponse.json({ success: true, data: { health, recordings, totals: { recorded: recordedCount, liveRecording: liveCount } } });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return fail("Unauthorized", 401);
  const body = (await request.json().catch(() => ({}))) as { action?: string; sessionId?: string };

  if (body.action === "selftest") {
    const res = await recorderSelfTest();
    await auditAdmin("training_recorder.selftest", admin.adminId, "TrainingRecorder", undefined, { ok: res.ok, error: res.error }).catch(() => {});
    return NextResponse.json({ success: res.ok, data: res, ...(res.ok ? {} : { error: { message: res.error || "Self-test failed" } }) });
  }

  if (body.action === "stop") {
    if (!body.sessionId) return fail("sessionId required");
    await stopRoomRecording(body.sessionId);
    await prisma.trainingSession.update({ where: { id: body.sessionId }, data: { recording: false, recordingStartedAt: null, recordingPausedAt: null } }).catch(() => {});
    await auditAdmin("training_recorder.force_stop", admin.adminId, "TrainingSession", body.sessionId).catch(() => {});
    return NextResponse.json({ success: true });
  }

  return fail("Unknown action");
}
