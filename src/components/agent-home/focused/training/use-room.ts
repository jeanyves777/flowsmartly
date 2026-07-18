"use client";

/**
 * The live-room client: SSE down, POST up.
 *
 * Same shape as `components/studio/hooks/use-collaboration.ts`, which has run in
 * prod behind our nginx for months — EventSource with exponential-backoff
 * reconnect, writes as plain fetch POSTs that the server fans out.
 *
 * Board ops apply OPTIMISTICALLY so the pen never feels laggy; the server is
 * still the authority and will refuse a write from someone without the pen, at
 * which point we roll the mark back. [[training-studio]]
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BoardItem,
  RoomEvent,
  TrainingParticipantDTO,
  TrainingSessionDTO,
} from "@/lib/training/types";
import type { BoardCursor } from "./training-board";

const CURSOR_COLORS = ["#22d3ee", "#f59e0b", "#a78bfa", "#10b981", "#fb7185", "#38bdf8", "#f472b6"];
export const cursorColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[h % CURSOR_COLORS.length];
};

interface RoomState {
  session: TrainingSessionDTO | null;
  me: TrainingParticipantDTO | null;
  cursors: BoardCursor[];
  connected: boolean;
  error: string | null;
}

export function useRoom(sessionId: string | null, opts?: { invite?: string; enabled?: boolean }) {
  const enabled = opts?.enabled !== false && !!sessionId;
  const [state, setState] = useState<RoomState>({
    session: null,
    me: null,
    cursors: [],
    connected: false,
    error: null,
  });
  const sessionKey = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const attempts = useRef(0);
  const cursorTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ---------------------------------------------------------------- subscribe
  useEffect(() => {
    if (!enabled || !sessionId) return;
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!alive) return;
      const qs = opts?.invite ? `?invite=${encodeURIComponent(opts.invite)}` : "";
      const es = new EventSource(`/api/ai/training/${sessionId}/stream${qs}`);
      esRef.current = es;

      es.onopen = () => {
        attempts.current = 0;
        setState((s) => ({ ...s, connected: true, error: null }));
      };

      es.onmessage = (ev) => {
        let msg: RoomEvent;
        try {
          msg = JSON.parse(ev.data) as RoomEvent;
        } catch {
          return;
        }
        if (!alive) return;

        setState((s) => {
          switch (msg.type) {
            case "room:init":
              sessionKey.current = msg.sessionKey;
              return { ...s, session: msg.session, me: msg.me, connected: true, error: null };

            case "room:state":
              return s.session ? { ...s, session: { ...s.session, ...msg.patch } } : s;

            case "room:join":
            case "room:participant":
            case "knock": {
              if (!s.session) return s;
              const others = s.session.participants.filter((p) => p.id !== msg.participant.id);
              const next = { ...s.session, participants: [...others, msg.participant] };
              // it might be US being admitted — keep `me` in step
              const me = s.me?.id === msg.participant.id ? msg.participant : s.me;
              return { ...s, session: next, me };
            }

            case "room:leave": {
              if (!s.session) return s;
              return {
                ...s,
                session: {
                  ...s.session,
                  participants: s.session.participants.map((p) =>
                    p.id === msg.participantId ? { ...p, state: "LEFT" as const } : p,
                  ),
                },
                cursors: s.cursors.filter((c) => c.participantId !== msg.participantId),
              };
            }

            case "board:add": {
              if (!s.session) return s;
              // ignore the echo of our own optimistic mark
              if (s.session.boardDoc.items.some((i) => i.id === msg.item.id)) return s;
              return {
                ...s,
                session: {
                  ...s.session,
                  boardDoc: { ...s.session.boardDoc, items: [...s.session.boardDoc.items, msg.item] },
                },
              };
            }
            case "board:update": {
              if (!s.session) return s;
              return {
                ...s,
                session: {
                  ...s.session,
                  boardDoc: {
                    ...s.session.boardDoc,
                    items: s.session.boardDoc.items.map((i) => (i.id === msg.item.id ? msg.item : i)),
                  },
                },
              };
            }
            case "board:remove": {
              if (!s.session) return s;
              return {
                ...s,
                session: {
                  ...s.session,
                  boardDoc: {
                    ...s.session.boardDoc,
                    items: s.session.boardDoc.items.filter((i) => i.id !== msg.itemId),
                  },
                },
              };
            }
            case "board:clear": {
              if (!s.session) return s;
              return { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: [] } } };
            }

            case "cursor":
            case "laser": {
              if (msg.participantId === s.me?.id) return s;
              const who = s.session?.participants.find((p) => p.id === msg.participantId);
              const cur: BoardCursor = {
                participantId: msg.participantId,
                name: who?.name || "Someone",
                color: cursorColor(msg.participantId),
                x: msg.x,
                y: msg.y,
                laser: msg.type === "laser",
              };
              const rest = s.cursors.filter((c) => c.participantId !== msg.participantId);
              return { ...s, cursors: [...rest, cur] };
            }

            default:
              return s;
          }
        });

        // Drop a cursor that has gone quiet, so ghosts don't pile up.
        if (msg.type === "cursor" || msg.type === "laser") {
          const id = msg.participantId;
          const t = cursorTimers.current.get(id);
          if (t) clearTimeout(t);
          cursorTimers.current.set(
            id,
            setTimeout(() => {
              setState((s) => ({ ...s, cursors: s.cursors.filter((c) => c.participantId !== id) }));
            }, 4000),
          );
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!alive) return;
        setState((s) => ({ ...s, connected: false }));
        // exponential backoff, capped — same as the design collab client
        const wait = Math.min(1000 * 2 ** attempts.current, 30_000);
        attempts.current += 1;
        retry = setTimeout(connect, wait);
      };
    };

    connect();
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      esRef.current?.close();
      esRef.current = null;
      cursorTimers.current.forEach((t) => clearTimeout(t));
      cursorTimers.current.clear();
    };
  }, [sessionId, enabled, opts?.invite]);

  // ------------------------------------------------------------------ writes
  const setSession = useCallback((next: TrainingSessionDTO) => {
    setState((s) => ({ ...s, session: next, me: next.participants.find((p) => p.id === s.me?.id) ?? s.me }));
  }, []);

  /** Draw. Applied locally first; rolled back if the server says no. */
  const addItem = useCallback(
    async (item: BoardItem) => {
      if (!sessionId) return;
      const stamped = { ...item, by: state.me?.id ?? "" } as BoardItem;
      setState((s) =>
        s.session
          ? { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: [...s.session.boardDoc.items, stamped] } } }
          : s,
      );
      try {
        const r = await fetch(`/api/ai/training/${sessionId}/board`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "add", item: stamped }),
        }).then((x) => x.json());
        if (!r?.success) throw new Error(r?.error?.message || "refused");
      } catch {
        setState((s) =>
          s.session
            ? { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: s.session.boardDoc.items.filter((i) => i.id !== stamped.id) } } }
            : s,
        );
      }
    },
    [sessionId, state.me?.id],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!sessionId) return;
      setState((s) =>
        s.session
          ? { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: s.session.boardDoc.items.filter((i) => i.id !== itemId) } } }
          : s,
      );
      await fetch(`/api/ai/training/${sessionId}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "remove", itemId }),
      }).catch(() => {});
    },
    [sessionId],
  );

  /** Move or edit a mark. Applied locally first; the server broadcasts the result. */
  const updateItem = useCallback(
    async (item: BoardItem) => {
      if (!sessionId) return;
      setState((s) =>
        s.session
          ? { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: s.session.boardDoc.items.map((i) => (i.id === item.id ? item : i)) } } }
          : s,
      );
      await fetch(`/api/ai/training/${sessionId}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "update", item }),
      }).catch(() => {});
    },
    [sessionId],
  );

  const clearBoard = useCallback(async () => {
    if (!sessionId) return;
    setState((s) => (s.session ? { ...s, session: { ...s.session, boardDoc: { ...s.session.boardDoc, items: [] } } } : s));
    await fetch(`/api/ai/training/${sessionId}/board`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "clear" }),
    }).catch(() => {});
  }, [sessionId]);

  /** Cursor / laser. Fire-and-forget — never awaited, never retried. */
  const ping = useCallback(
    (x: number, y: number, laser: boolean) => {
      if (!sessionId) return;
      void fetch(`/api/ai/training/${sessionId}/board`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: laser ? "laser" : "cursor", x, y, sessionKey: sessionKey.current }),
        keepalive: true,
      }).catch(() => {});
    },
    [sessionId],
  );

  /** Any host control over a person. Returns the refusal message, or null. */
  const act = useCallback(
    async (action: string, participantId?: string): Promise<string | null> => {
      if (!sessionId) return "No room";
      try {
        const r = await fetch(`/api/ai/training/${sessionId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, participantId }),
        }).then((x) => x.json());
        if (!r?.success) return r?.error?.message || "That didn't work";
        if (r.data?.session) setSession(r.data.session as TrainingSessionDTO);
        return null;
      } catch {
        return "That didn't work";
      }
    },
    [sessionId, setSession],
  );

  /** Room policy + the stage. */
  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<string | null> => {
      if (!sessionId) return "No room";
      try {
        const r = await fetch(`/api/ai/training/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((x) => x.json());
        if (!r?.success) return r?.error?.message || "That didn't work";
        if (r.data?.session) setSession(r.data.session as TrainingSessionDTO);
        return null;
      } catch {
        return "That didn't work";
      }
    },
    [sessionId, setSession],
  );

  return { ...state, addItem, removeItem, updateItem, clearBoard, ping, act, patch, setSession };
}
