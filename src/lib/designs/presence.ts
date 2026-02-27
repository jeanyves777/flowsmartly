/**
 * In-memory presence tracking for design collaboration.
 * Module-level singleton — all SSE connections share the same state.
 * Works because PM2 runs a single Node.js process (fork mode).
 */

export interface CursorPosition {
  x: number;
  y: number;
  pageIndex: number;
}

export interface PresenceEntry {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
  cursor: CursorPosition | null;
  selectedObjectId: string | null;
  lastSeen: number; // Date.now()
  controller: ReadableStreamDefaultController | null;
}

export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
  cursor: CursorPosition | null;
  selectedObjectId: string | null;
}

// designId -> Map<sessionKey, PresenceEntry>
const presenceMap = new Map<string, Map<string, PresenceEntry>>();

const STALE_TIMEOUT = 30_000; // 30 seconds without heartbeat = stale

function getDesignMap(designId: string): Map<string, PresenceEntry> {
  let map = presenceMap.get(designId);
  if (!map) {
    map = new Map();
    presenceMap.set(designId, map);
  }
  return map;
}

export function addPresence(
  designId: string,
  sessionKey: string,
  entry: PresenceEntry
): void {
  const map = getDesignMap(designId);
  map.set(sessionKey, entry);
}

export function removePresence(designId: string, sessionKey: string): void {
  const map = presenceMap.get(designId);
  if (!map) return;
  map.delete(sessionKey);
  if (map.size === 0) {
    presenceMap.delete(designId);
  }
}

export function getPresence(designId: string): PresenceUser[] {
  const map = presenceMap.get(designId);
  if (!map) return [];

  const now = Date.now();
  const users: PresenceUser[] = [];

  for (const [key, entry] of map) {
    // Remove stale entries
    if (now - entry.lastSeen > STALE_TIMEOUT) {
      map.delete(key);
      continue;
    }
    users.push({
      userId: entry.userId,
      userName: entry.userName,
      avatarUrl: entry.avatarUrl,
      role: entry.role,
      cursor: entry.cursor,
      selectedObjectId: entry.selectedObjectId,
    });
  }

  // Deduplicate by userId (keep the most recent)
  const seen = new Map<string, PresenceUser>();
  for (const user of users) {
    seen.set(user.userId, user);
  }

  return Array.from(seen.values());
}

export function updatePresenceHeartbeat(
  designId: string,
  sessionKey: string
): void {
  const map = presenceMap.get(designId);
  if (!map) return;
  const entry = map.get(sessionKey);
  if (entry) {
    entry.lastSeen = Date.now();
  }
}

export function updateCursor(
  designId: string,
  sessionKey: string,
  cursor: CursorPosition | null
): void {
  const map = presenceMap.get(designId);
  if (!map) return;
  const entry = map.get(sessionKey);
  if (entry) {
    entry.cursor = cursor;
    entry.lastSeen = Date.now();
  }
}

export function updateSelection(
  designId: string,
  sessionKey: string,
  selectedObjectId: string | null
): void {
  const map = presenceMap.get(designId);
  if (!map) return;
  const entry = map.get(sessionKey);
  if (entry) {
    entry.selectedObjectId = selectedObjectId;
    entry.lastSeen = Date.now();
  }
}

/**
 * Broadcast an SSE event to all connected clients for a design.
 * Optionally exclude a session (to avoid echo).
 */
export function broadcastToDesign(
  designId: string,
  eventType: string,
  data: unknown,
  excludeSession?: string
): void {
  const map = presenceMap.get(designId);
  if (!map) return;

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify({ type: eventType, ...((data && typeof data === "object") ? data : { data }) })}\n\n`;
  const encoded = encoder.encode(message);

  for (const [key, entry] of map) {
    if (key === excludeSession) continue;
    if (!entry.controller) continue;
    try {
      entry.controller.enqueue(encoded);
    } catch {
      // Controller closed — remove stale entry
      map.delete(key);
    }
  }
}
