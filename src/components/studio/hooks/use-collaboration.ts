"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "./use-canvas-store";

export interface CollabUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  role: "OWNER" | "EDITOR" | "VIEWER";
  cursor: { x: number; y: number; pageIndex: number } | null;
  selectedObjectId: string | null;
}

export interface CanvasOperation {
  type: "object:added" | "object:modified" | "object:removed" | "page:switched";
  objectId: string;
  objectJSON?: string;
  pageIndex: number;
  timestamp: number;
  userId: string;
  sessionKey: string;
}

interface UseCollaborationReturn {
  activeUsers: CollabUser[];
  isConnected: boolean;
  myRole: "OWNER" | "EDITOR" | "VIEWER" | null;
  sessionKey: string | null;
  broadcastOperation: (op: Omit<CanvasOperation, "userId" | "sessionKey" | "timestamp">) => void;
  sendCursorPosition: (x: number, y: number, pageIndex: number) => void;
  sendSelection: (objectId: string | null) => void;
}

export function useCollaboration(designId: string | null): UseCollaborationReturn {
  const [activeUsers, setActiveUsers] = useState<CollabUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myRole, setMyRole] = useState<"OWNER" | "EDITOR" | "VIEWER" | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSend = useRef(0);

  const shareToken = useCanvasStore((s) => s.shareToken);

  // Handle incoming SSE events
  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "presence:init":
          setActiveUsers(data.users || []);
          setSessionKey(data.sessionKey);
          setMyRole(data.myRole);
          setIsConnected(true);
          reconnectAttempts.current = 0;
          break;

        case "presence:join": {
          const newUser = data.user as CollabUser;
          setActiveUsers((prev) => {
            const exists = prev.some((u) => u.userId === newUser.userId);
            return exists ? prev : [...prev, newUser];
          });
          break;
        }

        case "presence:leave":
          setActiveUsers((prev) => prev.filter((u) => u.userId !== data.userId));
          break;

        case "cursor:move":
          setActiveUsers((prev) =>
            prev.map((u) =>
              u.userId === data.userId ? { ...u, cursor: data.cursor } : u
            )
          );
          break;

        case "selection:change":
          setActiveUsers((prev) =>
            prev.map((u) =>
              u.userId === data.userId
                ? { ...u, selectedObjectId: data.selectedObjectId }
                : u
            )
          );
          break;

        case "canvas:op": {
          // Dispatch a custom event that canvas-editor.tsx listens for
          const opEvent = new CustomEvent("collab:canvas-op", {
            detail: data.operation as CanvasOperation,
          });
          document.dispatchEvent(opEvent);
          break;
        }

        case "heartbeat":
          // Keep-alive, no action needed
          break;
      }
    } catch {
      // Malformed event, ignore
    }
  }, []);

  // Connect SSE
  useEffect(() => {
    if (!designId) return;

    const connect = () => {
      // Close existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const shareParam = shareToken ? `?share=${shareToken}` : "";
      const url = `/api/designs/${designId}/presence${shareParam}`;
      const es = new EventSource(url);

      es.onmessage = handleEvent;

      es.onerror = () => {
        es.close();
        setIsConnected(false);

        // Reconnect with exponential backoff
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current++;

        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      eventSourceRef.current = es;
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setIsConnected(false);
      setActiveUsers([]);
      setSessionKey(null);
      setMyRole(null);
    };
  }, [designId, shareToken, handleEvent]);

  // Broadcast canvas operation
  const broadcastOperation = useCallback(
    (op: Omit<CanvasOperation, "userId" | "sessionKey" | "timestamp">) => {
      if (!designId || !sessionKey) return;

      fetch(`/api/designs/${designId}/presence/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionKey,
          operation: { ...op, timestamp: Date.now(), sessionKey },
        }),
      }).catch(() => {
        // Non-critical — silent fail
      });
    },
    [designId, sessionKey]
  );

  // Send object selection change for soft locking
  const sendSelection = useCallback(
    (objectId: string | null) => {
      if (!designId || !sessionKey) return;

      fetch(`/api/designs/${designId}/presence/cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, selectedObjectId: objectId }),
      }).catch(() => {
        // Non-critical — silent fail
      });
    },
    [designId, sessionKey]
  );

  // Send cursor position (throttled to max every 50ms)
  const sendCursorPosition = useCallback(
    (x: number, y: number, pageIndex: number) => {
      if (!designId || !sessionKey) return;

      const now = Date.now();
      if (now - lastCursorSend.current < 50) {
        // Throttle: schedule a delayed send
        if (cursorThrottleRef.current) clearTimeout(cursorThrottleRef.current);
        cursorThrottleRef.current = setTimeout(() => {
          sendCursorPosition(x, y, pageIndex);
        }, 50);
        return;
      }

      lastCursorSend.current = now;

      fetch(`/api/designs/${designId}/presence/cursor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionKey, x, y, pageIndex }),
      }).catch(() => {
        // Silent fail
      });
    },
    [designId, sessionKey]
  );

  return {
    activeUsers,
    isConnected,
    myRole,
    sessionKey,
    broadcastOperation,
    sendCursorPosition,
    sendSelection,
  };
}
