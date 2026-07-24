import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canManageRoles } from "@/lib/training/access";
import { estimateSession, getSessionDTO, meterRoom } from "@/lib/training/session";
import { checkCreditsAvailable } from "@/lib/credits/costs";
import { broadcast } from "@/lib/training/room";
import { stopRoomRecording } from "@/lib/training/recorder";
import { ensureAICohost } from "@/lib/training/ai-cohost";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/**
 * POST — start or end the room.
 *
 * Going live is gated on being able to afford the FIRST block, not the whole
 * session: the meter charges incrementally as the room runs, so demanding the
 * full estimate up front would refuse rooms the host can actually pay for.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canManageRoles({ role: access.role })) return err("Only the room owner can start or end the session", 403);

  const b = (await request.json().catch(() => ({}))) as { action?: "start" | "end" };

  const room = await prisma.trainingSession.findUnique({
    where: { id },
    select: { status: true, seats: true, plannedMins: true, recording: true, transcript: true, startedAt: true },
  });
  if (!room) return err("Not found", 404);

  if (b.action === "start") {
    if (room.status === "live") return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
    if (room.status === "ended") return err("This session has already finished");

    const est = await estimateSession({
      seats: room.seats,
      plannedMins: room.plannedMins,
      recording: room.recording,
      transcript: room.transcript,
    });

    // Need enough for the first 10-attendee-minute block plus any one-offs.
    const upfront = Math.max(1, est.recording + est.transcript + 1);
    const gate = await checkCreditsAvailable(session.userId, upfront, false, false);
    if (gate) return NextResponse.json({ success: false, error: gate }, { status: 402 });

    // Put the presentation on the stage from the first second — prefer a slides deck
    // (the presenter's deck first) so the room never opens to an empty stage.
    const decks = await prisma.trainingMaterial.findMany({ where: { sessionId: id, kind: "slides" }, select: { id: true, deck: true, createdAt: true }, orderBy: { createdAt: "asc" } });
    const staged = decks.find((m) => { try { return !!(m.deck && (JSON.parse(m.deck) as { presenterActive?: boolean }).presenterActive); } catch { return false; } }) ?? decks[0] ?? null;
    const stagePatch = staged ? { stageSource: "slides" as const, stageKey: staged.id, stagePage: 1, stageStep: 1 } : {};

    // Recording NEVER auto-starts — a room always goes live with it OFF, and the host must click
    // "Start recording" during the session. This also clears any stale flag carried in from a
    // previous run (which is what made the REC timer count from hours ago).
    await prisma.trainingSession.update({
      where: { id },
      data: { status: "live", startedAt: room.startedAt ?? new Date(), recording: false, recordingStartedAt: null, recordingPausedAt: null, ...stagePatch },
    });
    broadcast(id, { type: "room:state", patch: { status: "live", recording: false, recordingStartedAt: null, recordingPausedAt: null, ...stagePatch } });
    await ensureAICohost(id).catch(() => {}); // the AI co-host joins if a presenter is active
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id), estimate: est } });
  }

  if (b.action === "end") {
    if (room.status !== "live") return err("That session isn't running");

    // Flush whatever time accrued since the last tick before closing the tab.
    await meterRoom(id, 0).catch(() => 0);

    // If the room was still recording, STOP it so the bot finalizes + uploads the file (else it
    // would keep capturing until its token expires and the recording would never be saved).
    if (room.recording) { void stopRoomRecording(id); }

    await prisma.trainingSession.update({
      where: { id },
      data: { status: "ended", endedAt: new Date(), recording: false, recordingStartedAt: null, recordingPausedAt: null },
    });
    await prisma.trainingParticipant.updateMany({
      where: { sessionId: id, leftAt: null },
      data: { leftAt: new Date(), sharing: false },
    });
    broadcast(id, { type: "room:state", patch: { status: "ended", recording: false } });
    return NextResponse.json({ success: true, data: { session: await getSessionDTO(id) } });
  }

  return err("Unknown action");
}
