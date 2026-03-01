"use client";

import { useRef, useCallback } from "react";
import { useVideoStore } from "../hooks/use-video-store";

interface TimelinePlayheadProps {
  containerHeight: number;
  onSeek: (time: number) => void;
}

export function TimelinePlayhead({ containerHeight, onSeek }: TimelinePlayheadProps) {
  const currentTime = useVideoStore((s) => s.currentTime);
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const scrollOffset = useVideoStore((s) => s.scrollOffset);

  const isDragging = useRef(false);

  const leftPx = (currentTime - scrollOffset) * timelineZoom;

  // Only show if in visible range
  if (leftPx < -10 || leftPx > 5000) return null;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;

      const parentRect = (e.currentTarget as HTMLElement)
        .closest("[data-timeline-tracks]")
        ?.getBoundingClientRect();
      if (!parentRect) return;

      const handleMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const x = me.clientX - parentRect.left - 140;
        const store = useVideoStore.getState();
        const time = Math.max(0, (x / store.timelineZoom) + store.scrollOffset);
        onSeek(time);
      };

      const handleUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      // Also seek on initial click position
      handleMove(e.nativeEvent);

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [onSeek]
  );

  return (
    <div
      className="absolute z-30 pointer-events-none"
      style={{
        left: `calc(140px + ${leftPx}px)`,
        top: 0,
        height: containerHeight,
      }}
    >
      {/* Wide invisible hitzone for easier grabbing (16px wide) */}
      <div
        className="absolute -left-2 top-0 w-4 h-full cursor-col-resize pointer-events-auto"
        onMouseDown={handleMouseDown}
      />

      {/* Triangle head at the top */}
      <div
        className="absolute -left-[6px] -top-[2px] pointer-events-auto cursor-col-resize"
        onMouseDown={handleMouseDown}
      >
        <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
          <path d="M7 12L0.5 0H13.5L7 12Z" fill="#ef4444" />
        </svg>
      </div>

      {/* Visible red line (2px) */}
      <div className="w-0.5 h-full bg-red-500 pointer-events-none" />
    </div>
  );
}
