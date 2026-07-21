import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { checkRoomAccess, canControlRoom } from "@/lib/training/access";
import { getSessionDTO } from "@/lib/training/session";
import { broadcast } from "@/lib/training/room";
import { startRoomRecording, stopRoomRecording } from "@/lib/training/recorder";
import type { AccessMode, SessionType, StageSource } from "@/lib/training/types";

const err = (message: string, status = 400) =>
  NextResponse.json({ success: false, error: { message } }, { status });

/** GET — the whole session (plan + live state + roster). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed && !access.waiting) return err(access.reason || "Access denied", 403);

  const dto = await getSessionDTO(id);
  if (!dto) return err("Not found", 404);
  return NextResponse.json({ success: true, data: { session: dto, myRole: access.role, waiting: !!access.waiting } });
}

interface PatchBody {
  title?: string;
  brief?: string;
  sessionType?: SessionType;
  seats?: number;
  startsAt?: string | null;
  access?: AccessMode;
  waitingRoom?: boolean;
  recording?: boolean;
  transcript?: boolean;
  openDraw?: boolean;
  openShare?: boolean;
  openMic?: boolean;
  locked?: boolean;
  hideBoard?: boolean;
  rosterLayout?: "side" | "top" | "bottom";
  spotlightId?: string | null;
  activeSegmentId?: string | null;
  joinHeadline?: string | null;
  joinMessage?: string | null;
  joinLogoUrl?: string | null;
  joinCollectEmail?: boolean;
  stageSource?: StageSource;
  stageKey?: string | null;
  stagePage?: number;
  stageStep?: number;
  aiPlaying?: boolean;
  recordingStartedAt?: string | null; // host resume shifts this forward past the paused span
  recordingPausedAt?: string | null;  // host pause/resume — synced so the timer freezes for all
}

/**
 * PATCH — room policy and the stage. Hosts/co-hosts only: these are the
 * controls that move everyone's screen, so a trainee must never reach them.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const access = await checkRoomAccess(id, session.userId);
  if (!access.allowed || !access.role) return err("Access denied", 403);
  if (!canControlRoom({ role: access.role })) return err("Only a host can change the room", 403);

  const b = (await request.json().catch(() => ({}))) as PatchBody;

  const data: Record<string, unknown> = {};
  if (typeof b.title === "string") data.title = b.title.slice(0, 120);
  if (typeof b.brief === "string") data.brief = b.brief;
  if (b.sessionType) data.sessionType = b.sessionType;
  if (typeof b.seats === "number") data.seats = Math.min(200, Math.max(1, b.seats));
  if (b.startsAt !== undefined) data.startsAt = b.startsAt ? new Date(b.startsAt) : null;
  if (b.access) data.access = b.access;
  for (const k of ["waitingRoom", "recording", "transcript", "openDraw", "openShare", "openMic", "locked", "hideBoard", "joinCollectEmail"] as const) {
    if (typeof b[k] === "boolean") data[k] = b[k];
  }
  // Stamp when recording BEGINS so every client's REC timer counts from the same
  // instant (not from each viewer's own join time). Clear both timestamps when it stops.
  if (typeof b.recording === "boolean") { data.recordingStartedAt = b.recording ? new Date() : null; data.recordingPausedAt = null; }
  // Pause/resume: the host sends recordingPausedAt (pause) or a shifted recordingStartedAt
  // + null recordingPausedAt (resume) so the timer stays consistent for everyone.
  if (b.recordingStartedAt !== undefined) data.recordingStartedAt = b.recordingStartedAt ? new Date(b.recordingStartedAt) : null;
  if (b.recordingPausedAt !== undefined) data.recordingPausedAt = b.recordingPausedAt ? new Date(b.recordingPausedAt) : null;
  if (b.rosterLayout && ["side", "top", "bottom"].includes(b.rosterLayout)) data.rosterLayout = b.rosterLayout;
  if (b.spotlightId !== undefined) data.spotlightId = b.spotlightId || null;
  if (b.activeSegmentId !== undefined) data.activeSegmentId = b.activeSegmentId || null;
  if (b.joinHeadline !== undefined) data.joinHeadline = b.joinHeadline ? String(b.joinHeadline).slice(0, 120) : null;
  if (b.joinMessage !== undefined) data.joinMessage = b.joinMessage ? String(b.joinMessage).slice(0, 400) : null;
  if (b.joinLogoUrl !== undefined) data.joinLogoUrl = b.joinLogoUrl || null;
  if (b.stageSource) data.stageSource = b.stageSource;
  if (b.stageKey !== undefined) data.stageKey = b.stageKey;
  if (typeof b.stagePage === "number") data.stagePage = Math.max(1, b.stagePage);
  if (typeof b.stageStep === "number") data.stageStep = Math.max(0, b.stageStep);
  if (typeof b.aiPlaying === "boolean") data.aiPlaying = b.aiPlaying;

  if (!Object.keys(data).length) return err("Nothing to change");

  await prisma.trainingSession.update({ where: { id }, data });

  // Recording toggled → tell the recorder bot to start/stop capturing the room (best-effort,
  // no-op if no recorder is configured). Pause/resume don't re-toggle `recording`, so this
  // only fires on a real start/stop.
  if (typeof b.recording === "boolean") { void (b.recording ? startRoomRecording(id) : stopRoomRecording(id)); }

  // The stage moves everyone — push it rather than making clients poll for it.
  const dto = await getSessionDTO(id);
  if (dto) {
    broadcast(id, {
      type: "room:state",
      patch: {
        stageSource: dto.stageSource,
        stageKey: dto.stageKey,
        stagePage: dto.stagePage,
        stageStep: dto.stageStep,
        aiPlaying: dto.aiPlaying,
        openDraw: dto.openDraw,
        openShare: dto.openShare,
        openMic: dto.openMic,
        waitingRoom: dto.waitingRoom,
        recording: dto.recording,
        recordingStartedAt: dto.recordingStartedAt,
        recordingPausedAt: dto.recordingPausedAt,
        locked: dto.locked,
        hideBoard: dto.hideBoard,
        rosterLayout: dto.rosterLayout,
        spotlightId: dto.spotlightId,
        activeSegmentId: dto.activeSegmentId,
        title: dto.title,
      },
    });
  }

  return NextResponse.json({ success: true, data: { session: dto } });
}

/** DELETE — only the owner can bin a room. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return err("Unauthorized", 401);
  const { id } = await params;

  const row = await prisma.trainingSession.findUnique({ where: { id }, select: { userId: true } });
  if (!row) return err("Not found", 404);
  if (row.userId !== session.userId) return err("Only the owner can delete this room", 403);

  await prisma.trainingSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
