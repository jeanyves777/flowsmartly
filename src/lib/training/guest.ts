/**
 * Training Room — anonymous guest identity.
 *
 * Attendees join by link with NO account. When they enter their name, we mint a
 * short-lived guest token that names exactly one participant in one session, and
 * set it as an httpOnly cookie scoped to that room. Every training route resolves
 * its actor from EITHER a logged-in session OR this guest cookie, so a guest can
 * draw, raise a hand and get admitted — but can never reach anything outside the
 * room they were invited to. Same idea as the DesignShare anon flow. [[training-studio]]
 */
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import type { ParticipantRole } from "./types";

const secret = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET || "dev-secret");

/** One cookie per room, so a guest can attend several rooms in different tabs. */
export const guestCookieName = (sessionId: string) => `tg_${sessionId}`;

export async function mintGuestToken(sessionId: string, participantId: string): Promise<string> {
  return new SignJWT({ sessionId, participantId, type: "training_guest" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifyGuestToken(token: string): Promise<{ sessionId: string; participantId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.type !== "training_guest") return null;
    return { sessionId: String(payload.sessionId), participantId: String(payload.participantId) };
  } catch {
    return null;
  }
}

export interface TrainingActor {
  participantId: string;
  role: ParticipantRole;
  userId: string | null;
  state: string;
  isGuest: boolean;
}

/**
 * Resolve who is acting on a room, from a logged-in session OR the guest cookie.
 * The single auth entry point for training routes — returns null when neither
 * identifies an active (non-removed) participant of THIS session.
 */
export async function getTrainingActor(sessionId: string): Promise<TrainingActor | null> {
  // 1) logged-in user (owner is always HOST even without a participant row)
  const session = await getSession();
  if (session) {
    const room = await prisma.trainingSession.findUnique({ where: { id: sessionId }, select: { userId: true } });
    if (room?.userId === session.userId) {
      // seat the owner as HOST if they haven't "joined" their own room yet
      let host = await prisma.trainingParticipant.findFirst({
        where: { sessionId, userId: session.userId },
        select: { id: true, role: true, state: true },
      });
      if (!host) {
        host = await prisma.trainingParticipant.create({
          data: {
            sessionId,
            userId: session.userId,
            name: session.user.name || session.user.email || "Host",
            email: session.user.email ?? null,
            avatarUrl: session.user.avatarUrl ?? null,
            role: "HOST",
            state: "ADMITTED",
            canShare: true,
            canDraw: true,
            joinedAt: new Date(),
          },
          select: { id: true, role: true, state: true },
        });
      }
      return { participantId: host.id, role: host.role as ParticipantRole, userId: session.userId, state: host.state, isGuest: false };
    }
    const p = await prisma.trainingParticipant.findFirst({
      where: { sessionId, userId: session.userId },
      select: { id: true, role: true, state: true },
    });
    if (p && p.state !== "REMOVED" && p.state !== "DENIED") {
      return { participantId: p.id, role: p.role as ParticipantRole, userId: session.userId, state: p.state, isGuest: false };
    }
  }

  // 2) anonymous guest cookie for this room
  const jar = await cookies();
  const token = jar.get(guestCookieName(sessionId))?.value;
  if (token) {
    const g = await verifyGuestToken(token);
    if (g && g.sessionId === sessionId) {
      const p = await prisma.trainingParticipant.findFirst({
        where: { id: g.participantId, sessionId },
        select: { id: true, role: true, state: true, userId: true },
      });
      if (p && p.state !== "REMOVED" && p.state !== "DENIED") {
        return { participantId: p.id, role: p.role as ParticipantRole, userId: p.userId, state: p.state, isGuest: !p.userId };
      }
    }
  }

  return null;
}
