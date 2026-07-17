/**
 * Training Studio — who may do what.
 *
 * The single source of truth for room permissions. Both the API routes and the
 * UI import these, so a button can never offer something the server refuses.
 *
 * Two different shapes, deliberately:
 *  - the PEN is a handoff — exactly one holder, passed explicitly
 *  - SCREEN SHARE is a grant — many may hold the right, one occupies the stage
 * [[training-studio]]
 */
import { prisma } from "@/lib/db/client";
import type { ParticipantRole, TrainingParticipantDTO, TrainingSessionDTO } from "./types";

/** Hosts and co-hosts run the room. Everyone else is an attendee. */
export function isHost(role: ParticipantRole): boolean {
  return role === "HOST" || role === "COHOST";
}

/** May this person draw on the board right now? */
export function canDraw(
  p: Pick<TrainingParticipantDTO, "id" | "role" | "canDraw">,
  s: Pick<TrainingSessionDTO, "openDraw" | "penHolderId">,
): boolean {
  if (isHost(p.role)) return true;
  if (s.openDraw) return true;
  if (s.penHolderId === p.id) return true; // holds the pen
  return p.canDraw; // explicitly granted for this session
}

/**
 * May this person put their screen on the stage?
 * Hosts/co-hosts always may; a trainee only when granted, or when the room is
 * open. This is the "allow selected participants to share screen" rule.
 */
export function canShareScreen(
  p: Pick<TrainingParticipantDTO, "role" | "canShare">,
  s: Pick<TrainingSessionDTO, "openShare">,
): boolean {
  if (isHost(p.role)) return true;
  if (s.openShare) return true;
  return p.canShare;
}

/** May this person unmute themselves? */
export function canUnmute(
  p: Pick<TrainingParticipantDTO, "role">,
  s: Pick<TrainingSessionDTO, "openMic">,
): boolean {
  return isHost(p.role) || s.openMic;
}

/** Only a host/co-host may drive the stage, admit people, or change policy. */
export function canControlRoom(p: Pick<TrainingParticipantDTO, "role">): boolean {
  return isHost(p.role);
}

/** Only the OWNER (the single HOST) may promote/demote co-hosts or end the room. */
export function canManageRoles(p: Pick<TrainingParticipantDTO, "role">): boolean {
  return p.role === "HOST";
}

export interface RoomAccess {
  allowed: boolean;
  participantId?: string;
  role?: ParticipantRole;
  /** set when the room requires the host to let them in first */
  waiting?: boolean;
  reason?: string;
}

/**
 * Resolve a signed-in user against a session. The owner is always HOST even if
 * no participant row exists yet (they haven't "joined" their own room).
 */
export async function checkRoomAccess(sessionId: string, userId: string): Promise<RoomAccess> {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true },
  });
  if (!session) return { allowed: false, reason: "No such session" };
  if (session.userId === userId) return { allowed: true, role: "HOST" };

  const p = await prisma.trainingParticipant.findFirst({
    where: { sessionId, userId },
    select: { id: true, role: true, state: true },
  });
  if (!p) return { allowed: false, reason: "Not invited" };
  if (p.state === "REMOVED" || p.state === "DENIED") return { allowed: false, reason: "Removed from this room" };
  return {
    allowed: p.state === "ADMITTED",
    participantId: p.id,
    role: p.role as ParticipantRole,
    waiting: p.state === "WAITING",
  };
}

export interface InviteAccess {
  sessionId: string;
  role: ParticipantRole;
  inviteId: string;
  /** the room makes them knock before they're in */
  waitingRoom: boolean;
}

/**
 * Resolve a join link. Mirrors checkShareTokenAccess for designs: the token
 * carries the role, and expiry / use-cap / active are all enforced here so no
 * caller has to remember to.
 */
export async function checkInviteToken(token: string): Promise<InviteAccess | null> {
  const invite = await prisma.trainingInvite.findUnique({
    where: { token },
    select: {
      id: true,
      sessionId: true,
      role: true,
      isActive: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      session: { select: { waitingRoom: true, locked: true, status: true } },
    },
  });
  if (!invite || !invite.isActive) return null;
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return null;
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return null;
  if (invite.session.locked) return null; // a locked room refuses the link too
  if (invite.session.status === "ended") return null;

  return {
    sessionId: invite.sessionId,
    role: invite.role as ParticipantRole,
    inviteId: invite.id,
    waitingRoom: invite.session.waitingRoom,
  };
}
