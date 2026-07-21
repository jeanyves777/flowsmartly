/**
 * Training Room — the RECORDING seam.
 *
 * Full-room recording is done by a headless-Chrome "recorder bot" that runs on the
 * media box (infra/recorder). It JOINS the room like an invisible attendee, renders the
 * real live UI — slides, AI narration, whiteboard, camera tiles — and screen-records it,
 * then uploads the file and registers its URL back here.
 *
 * This module is the only place the web app knows the recorder exists. Deliberately
 * OPTIONAL, exactly like lib/training/sfu: with TRAINING_RECORDER_URL unset,
 * `recorderConfigured()` is false and start/stop are no-ops — every room still works,
 * just without a saved recording. So merging this can never break prod before the box
 * exists. [[training-studio]]
 */
import { SignJWT, jwtVerify } from "jose";

/** Is a recorder service wired up in this environment? */
export function recorderConfigured(): boolean {
  return !!process.env.TRAINING_RECORDER_URL && !!process.env.TRAINING_RECORDER_SECRET;
}

const secret = () =>
  new TextEncoder().encode(process.env.TRAINING_RECORDER_SECRET || process.env.TRAINING_SFU_SECRET || "");

/**
 * A ticket the recorder bot carries to (a) open the private /rec/[id] capture page as an
 * authenticated observer and (b) register the finished file. Scoped to ONE session, longer
 * TTL than the SFU ticket because a recording can run the whole session.
 */
export async function mintRecorderToken(sessionId: string, ttl = "8h"): Promise<string> {
  return new SignJWT({ sessionId, role: "recorder" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("flowsmartly")
    .setAudience("recorder")
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

/** Verify a recorder ticket is valid FOR THIS session (used by the capture page + register API). */
export async function verifyRecorderToken(token: string | null | undefined, sessionId: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: "flowsmartly", audience: "recorder" });
    return payload.role === "recorder" && String(payload.sessionId) === sessionId;
  } catch {
    return false;
  }
}

/** Ask the recorder service to START capturing a room (best-effort; no-op if unconfigured). */
export async function startRoomRecording(sessionId: string): Promise<void> {
  if (!recorderConfigured()) return;
  try {
    const token = await mintRecorderToken(sessionId);
    await fetch(`${process.env.TRAINING_RECORDER_URL}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-recorder-secret": process.env.TRAINING_RECORDER_SECRET! },
      body: JSON.stringify({ sessionId, token }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[recorder] start failed:", e instanceof Error ? e.message : e);
  }
}

/** Ask the recorder service to STOP + finalize (best-effort; no-op if unconfigured). */
export async function stopRoomRecording(sessionId: string): Promise<void> {
  if (!recorderConfigured()) return;
  try {
    await fetch(`${process.env.TRAINING_RECORDER_URL}/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-recorder-secret": process.env.TRAINING_RECORDER_SECRET! },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("[recorder] stop failed:", e instanceof Error ? e.message : e);
  }
}
