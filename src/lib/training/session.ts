/**
 * Training Studio — the session engine.
 *
 * Serialization to the DTO the UI reads, the credit estimate the brief shows,
 * and the incremental meter that bills a live room. [[training-studio]]
 */
import { prisma } from "@/lib/db/client";
import { creditService } from "@/lib/credits";
import { getDynamicCreditCost } from "@/lib/credits/costs";
import {
  EMPTY_BOARD,
  type BoardDoc,
  type TrainingSessionDTO,
  type TrainingSegmentDTO,
  type TrainingParticipantDTO,
  type TrainingMaterialDTO,
  type TrainingInviteDTO,
  type SegmentKind,
  type SessionType,
  type SessionStatus,
  type AccessMode,
  type StageSource,
  type ParticipantRole,
  type ParticipantState,
  type MaterialKind,
} from "./types";

/** Parse a JSON column without ever throwing into a route. */
function json<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function parseBoard(raw: string | null | undefined): BoardDoc {
  const doc = json<Partial<BoardDoc>>(raw, {});
  if (!doc || !Array.isArray(doc.items)) return { ...EMPTY_BOARD, items: [] };
  return { v: 1, bg: doc.bg ?? "grid", items: doc.items };
}

// ------------------------------------------------------------------ estimate
export interface TrainingEstimate {
  room: number;
  recording: number;
  transcript: number;
  total: number;
  breakdown: { label: string; credits: number }[];
}

/**
 * What a session will cost. Mirrors the meter exactly (10 attendee-minute
 * blocks) so the number in the brief is the number that gets charged.
 */
export async function estimateSession(opts: {
  seats: number;
  plannedMins: number;
  recording: boolean;
  transcript: boolean;
}): Promise<TrainingEstimate> {
  const [per10, recCost, txCost] = await Promise.all([
    getDynamicCreditCost("TRAINING_ATTENDEE_10MIN"),
    getDynamicCreditCost("TRAINING_RECORDING"),
    getDynamicCreditCost("TRAINING_TRANSCRIPT"),
  ]);

  const attendeeMinutes = Math.max(0, opts.seats) * Math.max(0, opts.plannedMins);
  const room = Math.round((attendeeMinutes / 10) * per10);
  const recording = opts.recording ? recCost : 0;
  const transcript = opts.transcript ? txCost : 0;

  const breakdown = [
    { label: `Room · ${opts.seats} seats × ${opts.plannedMins} min`, credits: room },
    ...(opts.recording ? [{ label: "Recording", credits: recording }] : []),
    ...(opts.transcript ? [{ label: "Live transcript + summary", credits: transcript }] : []),
  ];

  return { room, recording, transcript, total: room + recording + transcript, breakdown };
}

// --------------------------------------------------------------------- meter
/**
 * Bill a live room for the attendee-time accrued since the last tick.
 *
 * Charged incrementally in whole 10-attendee-minute blocks, carrying the
 * remainder forward in metadata — so a room whose host never clicks "End
 * session", or whose process is SIGKILLed by a pm2 reload, is still paid for up
 * to the last tick instead of leaving an unbilled tab. Same reasoning as
 * VOICE_AGENT_MINUTE. Returns the credits actually charged.
 */
export async function meterRoom(sessionId: string, attendeeSeconds: number): Promise<number> {
  if (attendeeSeconds <= 0) return 0;

  const s = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { userId: true, status: true, metadata: true, creditsSpent: true },
  });
  if (!s || s.status !== "live") return 0;

  const meta = json<{ meterRemainderSec?: number }>(s.metadata, {});
  const pending = (meta.meterRemainderSec ?? 0) + attendeeSeconds;

  const BLOCK_SEC = 10 * 60; // 10 attendee-minutes
  const blocks = Math.floor(pending / BLOCK_SEC);
  const remainder = pending - blocks * BLOCK_SEC;

  if (blocks <= 0) {
    await prisma.trainingSession.update({
      where: { id: sessionId },
      data: { metadata: JSON.stringify({ ...meta, meterRemainderSec: remainder }) },
    });
    return 0;
  }

  const per10 = await getDynamicCreditCost("TRAINING_ATTENDEE_10MIN");
  const charge = blocks * per10;

  const res = await creditService.deductCredits({
    userId: s.userId,
    type: "USAGE",
    amount: charge,
    description: `Training room: ${blocks * 10} attendee-minutes`,
    referenceType: "training_session",
    referenceId: sessionId,
  });

  await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      metadata: JSON.stringify({ ...meta, meterRemainderSec: remainder }),
      ...(res.success ? { creditsSpent: { increment: charge } } : {}),
    },
  });

  return res.success ? charge : 0;
}

// ----------------------------------------------------------------- serialize
type SessionWithRelations = NonNullable<Awaited<ReturnType<typeof loadSessionRow>>>;

function loadSessionRow(id: string) {
  return prisma.trainingSession.findUnique({
    where: { id },
    include: {
      segments: { orderBy: { order: "asc" } },
      participants: { orderBy: { createdAt: "asc" } },
      materials: { orderBy: { createdAt: "asc" } },
      invites: { orderBy: { createdAt: "asc" } },
      // the owner's brand logo — the join page defaults to it (no re-upload)
      user: { select: { brandKits: { orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], take: 1, select: { logo: true, iconLogo: true } } } },
    },
  });
}

export function toSessionDTO(row: SessionWithRelations): TrainingSessionDTO {
  return {
    id: row.id,
    title: row.title,
    brief: row.brief,
    sessionType: row.sessionType as SessionType,
    status: row.status as SessionStatus,
    seats: row.seats,
    plannedMins: row.plannedMins,
    startsAt: row.startsAt?.toISOString() ?? null,
    startedAt: row.startedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    access: row.access as AccessMode,

    waitingRoom: row.waitingRoom,
    recording: row.recording,
    transcript: row.transcript,
    joinHeadline: row.joinHeadline,
    joinMessage: row.joinMessage,
    joinLogoUrl: row.joinLogoUrl,
    joinBannerUrl: row.joinBannerUrl,
    brandLogoUrl: row.user?.brandKits?.[0]?.logo || row.user?.brandKits?.[0]?.iconLogo || null,
    joinCollectEmail: row.joinCollectEmail,
    openDraw: row.openDraw,
    openShare: row.openShare,
    openMic: row.openMic,
    locked: row.locked,
    hideBoard: row.hideBoard,

    penHolderId: row.penHolderId,
    stageSource: row.stageSource as StageSource,
    stageKey: row.stageKey,
    stagePage: row.stagePage,
    boardDoc: parseBoard(row.boardDoc),
    recordingUrl: row.recordingUrl,
    creditsSpent: row.creditsSpent,

    segments: row.segments.map(
      (s): TrainingSegmentDTO => ({
        id: s.id,
        kind: s.kind as SegmentKind,
        title: s.title,
        note: s.note,
        durationMins: s.durationMins,
        order: s.order,
        x: s.x,
        y: s.y,
        ready: s.ready,
        materialId: s.materialId,
        config: json<Record<string, unknown>>(s.config, {}),
      }),
    ),
    participants: row.participants
      // LEFT people are gone until they reconnect (the stream restores their
      // state on re-entry), so a later room:state broadcast can't re-add them.
      .filter((p) => p.state !== "REMOVED" && p.state !== "DENIED" && p.state !== "LEFT")
      .map(
        (p): TrainingParticipantDTO => ({
          id: p.id,
          userId: p.userId,
          name: p.name,
          email: p.email,
          avatarUrl: p.avatarUrl,
          role: p.role as ParticipantRole,
          state: p.state as ParticipantState,
          canShare: p.canShare,
          canDraw: p.canDraw,
          micOn: p.micOn,
          camOn: p.camOn,
          handRaised: p.handRaised,
          sharing: p.sharing,
          joinedAt: p.joinedAt?.toISOString() ?? null,
          focusPct: p.focusPct,
          secondsIn: p.secondsIn,
        }),
      ),
    materials: row.materials.map(
      (m): TrainingMaterialDTO => ({
        id: m.id,
        name: m.name,
        kind: m.kind as MaterialKind,
        url: m.url,
        pages: m.pages,
        sizeBytes: m.sizeBytes,
      }),
    ),
    invites: row.invites.map(
      (i): TrainingInviteDTO => ({
        id: i.id,
        token: i.token,
        email: i.email,
        role: i.role as ParticipantRole,
        label: i.label,
        useCount: i.useCount,
        maxUses: i.maxUses,
        isActive: i.isActive,
        sentAt: i.sentAt?.toISOString() ?? null,
      }),
    ),
  };
}

export async function getSessionDTO(id: string): Promise<TrainingSessionDTO | null> {
  const row = await loadSessionRow(id);
  return row ? toSessionDTO(row) : null;
}

/** A short session name derived from the brief, like the Director's autoFilmName. */
export function autoTitle(brief: string): string {
  const first = (brief || "").split(/[.!?\n]/)[0].trim();
  const words = first.split(/\s+/).filter(Boolean).slice(0, 7).join(" ");
  return (words ? words.charAt(0).toUpperCase() + words.slice(1) : "Untitled session").slice(0, 60);
}

/** A join token — same generator shape as DesignShare's. */
export function newToken(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}
