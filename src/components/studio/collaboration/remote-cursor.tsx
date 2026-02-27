"use client";

import type { CollabUser } from "../hooks/use-collaboration";

const CURSOR_COLORS: Record<string, string> = {
  OWNER: "#f59e0b",
  EDITOR: "#22c55e",
  VIEWER: "#3b82f6",
};

interface RemoteCursorsProps {
  users: CollabUser[];
  myUserId: string | null;
  activePageIndex: number;
  zoom: number;
  pan: { x: number; y: number };
  canvasRect: { left: number; top: number } | null;
}

export function RemoteCursors({
  users,
  myUserId,
  activePageIndex,
  zoom,
  pan,
  canvasRect,
}: RemoteCursorsProps) {
  if (!canvasRect) return null;

  const remoteCursors = users.filter(
    (u) =>
      u.userId !== myUserId &&
      u.cursor &&
      u.cursor.pageIndex === activePageIndex
  );

  if (remoteCursors.length === 0) return null;

  return (
    <>
      {remoteCursors.map((user) => {
        if (!user.cursor) return null;
        const color = CURSOR_COLORS[user.role] || "#6b7280";

        // Convert canvas coordinates to screen coordinates
        const screenX = canvasRect.left + user.cursor.x * zoom + pan.x;
        const screenY = canvasRect.top + user.cursor.y * zoom + pan.y;

        return (
          <div
            key={user.userId}
            className="fixed pointer-events-none z-50"
            style={{
              left: screenX,
              top: screenY,
              transition: "left 0.1s linear, top 0.1s linear",
            }}
          >
            {/* Cursor arrow */}
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
            >
              <path
                d="M0 0L16 12L8 12L4 20L0 0Z"
                fill={color}
              />
              <path
                d="M0 0L16 12L8 12L4 20L0 0Z"
                stroke="white"
                strokeWidth="1"
              />
            </svg>

            {/* Name label */}
            <div
              className="absolute top-4 left-3 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
              style={{ backgroundColor: color }}
            >
              {user.userName}
            </div>
          </div>
        );
      })}
    </>
  );
}
