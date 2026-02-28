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
        .parentElement?.getBoundingClientRect();
      if (!parentRect) return;

      const handleMove = (me: MouseEvent) => {
        if (!isDragging.current) return;
        const x = me.clientX - parentRect.left;
        // Subtract the track header width (140px)
        const adjustedX = x - 140;
        const time = Math.max(0, (adjustedX / timelineZoom) + scrollOffset);
        onSeek(time);
      };

      const handleUp = () => {
        isDragging.current = false;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [timelineZoom, scrollOffset, onSeek]
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
      {/* Playhead line */}
      <div className="w-0.5 h-full bg-red-500 pointer-events-auto cursor-col-resize"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
