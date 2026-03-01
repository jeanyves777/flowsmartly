"use client";

import { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { useVideoStore } from "../hooks/use-video-store";
import { TimelineRuler } from "./timeline-ruler";
import { TimelineTrack } from "./timeline-track";
import { TimelinePlayhead } from "./timeline-playhead";
import { TimelineControls } from "./timeline-controls";

interface VideoTimelineProps {
  onSeek: (time: number) => void;
}

export function VideoTimeline({ onSeek }: VideoTimelineProps) {
  const tracks = useVideoStore((s) => s.tracks);
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);
  const scrollOffset = useVideoStore((s) => s.scrollOffset);
  const setScrollOffset = useVideoStore((s) => s.setScrollOffset);

  const [height, setHeight] = useState(250);
  const trackAreaRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef({ startY: 0, startHeight: 0 });

  // Resize handle drag
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startHeight: height };

      const handleMove = (me: MouseEvent) => {
        const dy = resizeRef.current.startY - me.clientY;
        setHeight(Math.max(120, Math.min(600, resizeRef.current.startHeight + dy)));
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [height]
  );

  // Horizontal scroll via non-passive native listener so we can preventDefault
  // Only intercepts horizontal swipe (trackpad) or shift+wheel (mouse); vertical passes through
  useEffect(() => {
    const el = trackAreaRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const isHorizontalSwipe = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const isShiftWheel = e.shiftKey && Math.abs(e.deltaY) > 0;

      if (!isHorizontalSwipe && !isShiftWheel) return; // let vertical scroll pass through

      const rawDelta = isHorizontalSwipe ? e.deltaX : e.deltaY;
      const store = useVideoStore.getState();
      const delta = rawDelta / store.timelineZoom;
      const maxOffset = Math.max(0, store.timelineDuration);
      const newOffset = Math.max(0, Math.min(maxOffset, store.scrollOffset + delta));
      store.setScrollOffset(newOffset);
      e.preventDefault();
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Compute total track area height for playhead
  const trackAreaHeight = tracks.reduce((sum, t) => sum + t.height, 0);

  // Max scroll offset (in seconds)
  const maxScrollOffset = useMemo(
    () => Math.max(0, timelineDuration),
    [timelineDuration]
  );

  // Only show scrollbar when there's content to scroll
  const showScrollbar = timelineDuration > 0;

  return (
    <div className="border-t bg-background flex flex-col shrink-0" style={{ height }}>
      {/* Resize handle */}
      <div
        className="h-1.5 bg-border/50 hover:bg-brand-500/50 cursor-ns-resize transition-colors"
        onMouseDown={handleResizeStart}
      />

      {/* Ruler */}
      <div className="pl-[140px]">
        <TimelineRuler onSeek={onSeek} />
      </div>

      {/* Tracks area with playhead */}
      <div
        ref={trackAreaRef}
        data-timeline-tracks
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        {/* Playhead spanning all tracks */}
        <TimelinePlayhead
          containerHeight={Math.max(trackAreaHeight, 100)}
          onSeek={onSeek}
        />

        {/* Tracks */}
        {tracks.map((track) => (
          <TimelineTrack key={track.id} track={track} />
        ))}

        {/* Empty state */}
        {tracks.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            No tracks — add one below
          </div>
        )}
      </div>

      {/* Horizontal scrollbar */}
      {showScrollbar && (
        <div className="h-4 pl-[140px] pr-2 bg-muted/20 border-t border-border/30 flex items-center">
          <input
            type="range"
            min={0}
            max={maxScrollOffset}
            step={0.5}
            value={scrollOffset}
            onChange={(e) => setScrollOffset(parseFloat(e.target.value))}
            className="w-full h-1.5 accent-muted-foreground/50 cursor-pointer"
          />
        </div>
      )}

      {/* Bottom controls */}
      <TimelineControls />
    </div>
  );
}
