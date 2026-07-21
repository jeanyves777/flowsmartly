/**
 * Training Studio — the live room transport.
 *
 * Read = SSE (GET), write = plain POST that fans out server-side. Exactly the
 * shape `lib/designs/presence.ts` already runs in prod, which matters: it works
 * behind our nginx today with no proxy changes (each SSE route sets
 * X-Accel-Buffering: no).
 *
 * IMPORTANT — module-level singleton, same constraint as designs/presence:
 * this only works because PM2 runs a single Node process (fork mode). If we
 * ever go cluster, this registry must move onto `lib/ai/flow-agent/redis-bus`.
 * Room *state* is safe either way — it lives in Postgres, not here; only the
 * live sockets are in memory. [[training-studio]]
 */
import type { RoomEvent } from "./types";

interface RoomConn {
  participantId: string;
  lastSeen: number;
  controller: ReadableStreamDefaultController | null;
}

// sessionId -> Map<sessionKey, RoomConn>
//
// MUST live on globalThis, NOT a plain module const: Next.js (app router) bundles each
// route segment separately, so the SSE `stream` route and the writer routes (PATCH,
// participants…) each get their OWN instance of this module — and thus their own Map.
// A connection registered by the stream route would then be invisible to broadcast() in
// the PATCH route, so live events (stage steps, hand-raises) never reach attendees.
// Pinning the registry to globalThis makes every route share the one true Map.
const rooms: Map<string, Map<string, RoomConn>> =
  ((globalThis as unknown as { __trainingRooms?: Map<string, Map<string, RoomConn>> }).__trainingRooms ??=
    new Map<string, Map<string, RoomConn>>());

const STALE_TIMEOUT = 30_000;

function roomMap(sessionId: string): Map<string, RoomConn> {
  let m = rooms.get(sessionId);
  if (!m) {
    m = new Map();
    rooms.set(sessionId, m);
  }
  return m;
}

export function addConn(sessionId: string, sessionKey: string, conn: RoomConn): void {
  roomMap(sessionId).set(sessionKey, conn);
}

export function removeConn(sessionId: string, sessionKey: string): void {
  const m = rooms.get(sessionId);
  if (!m) return;
  m.delete(sessionKey);
  if (m.size === 0) rooms.delete(sessionId);
}

export function touchConn(sessionId: string, sessionKey: string): void {
  const c = rooms.get(sessionId)?.get(sessionKey);
  if (c) c.lastSeen = Date.now();
}

/** Participant ids with a live socket right now (stale ones are reaped). */
export function connectedIds(sessionId: string): string[] {
  const m = rooms.get(sessionId);
  if (!m) return [];
  const now = Date.now();
  const ids = new Set<string>();
  for (const [key, c] of m) {
    if (now - c.lastSeen > STALE_TIMEOUT) {
      m.delete(key);
      continue;
    }
    ids.add(c.participantId);
  }
  return [...ids];
}

export function frameEvent(event: RoomEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/** Push an event to everyone in the room, optionally skipping the sender. */
export function broadcast(sessionId: string, event: RoomEvent, excludeSessionKey?: string): void {
  const m = rooms.get(sessionId);
  if (!m) return;

  const encoded = frameEvent(event);
  for (const [key, c] of m) {
    if (key === excludeSessionKey) continue;
    if (!c.controller) continue;
    try {
      c.controller.enqueue(encoded);
    } catch {
      m.delete(key); // controller closed under us
    }
  }
}

/** Push to one specific participant (all their tabs) — used for "you're admitted". */
export function sendTo(sessionId: string, participantId: string, event: RoomEvent): void {
  const m = rooms.get(sessionId);
  if (!m) return;
  const encoded = frameEvent(event);
  for (const [key, c] of m) {
    if (c.participantId !== participantId || !c.controller) continue;
    try {
      c.controller.enqueue(encoded);
    } catch {
      m.delete(key);
    }
  }
}
