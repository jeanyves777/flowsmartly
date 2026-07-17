/**
 * Training Room — the media transport seam.
 *
 * The SFU is a SEPARATE service on its own box (infra/sfu). Browsers connect to
 * it directly, so media never touches the app VPS. This module is the only place
 * the web app knows it exists.
 *
 * Deliberately optional: with TRAINING_SFU_URL unset, `sfuConfigured()` is false
 * and every room still works — board, docs, permissions, roster, metering — just
 * without video. Same graceful-degrade contract as lib/ai/flow-agent/redis-bus,
 * and the reason merging this can't break prod before the box exists.
 * [[training-studio]]
 */
import { SignJWT } from "jose";

/** Is a media server wired up in this environment? */
export function sfuConfigured(): boolean {
  return !!process.env.TRAINING_SFU_URL && !!process.env.TRAINING_SFU_SECRET;
}

export interface SfuGrant {
  enabled: boolean;
  url?: string;
  token?: string;
  /** why video is off, in words a user can act on */
  reason?: string;
}

/**
 * Mint a short-lived ticket for one participant to join one room's media.
 *
 * `canShare` is baked into the token and re-checked by the SFU on every screen
 * produce — so revoking someone's share right actually stops their screen, and a
 * forged client request is refused at the media layer, not just hidden in the UI.
 * Short TTL (2 min) because it's only used to open the socket; the socket then
 * lives as long as the call.
 */
export async function mintSfuToken(opts: {
  sessionId: string;
  participantId: string;
  canShare: boolean;
}): Promise<SfuGrant> {
  if (!sfuConfigured()) {
    return { enabled: false, reason: "Video isn't switched on for this room yet." };
  }

  const token = await new SignJWT({
    sessionId: opts.sessionId,
    participantId: opts.participantId,
    canShare: opts.canShare,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("flowsmartly")
    .setAudience("sfu")
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(new TextEncoder().encode(process.env.TRAINING_SFU_SECRET!));

  return { enabled: true, url: process.env.TRAINING_SFU_URL!, token };
}
