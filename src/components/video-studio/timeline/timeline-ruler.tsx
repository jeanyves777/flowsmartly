"use client";

import { useCallback, useRef } from "react";
import { useVideoStore } from "../hooks/use-video-store";

function formatRulerTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins > 0) return `${mins}:${String(secs).padStart(2, "0")}`;
  return `0:${String(secs).padStart(2, "0")}`;
}

interface TimelineRulerProps {
  onSeek: (time: number) => void;
}

export function TimelineRuler({ onSeek }: TimelineRulerProps) {
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const scrollOffset = useVideoStore((s) => s.scrollOffset);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);
  const currentTime = useVideoStore((s) => s.currentTime);
  const rulerRef = useRef<HTMLDivElement>(null);

  // Determine tick interval based on zoom level
  const getTickInterval = useCallback(() => {
    if (timelineZoom >= 150) return 1;      // every 1s
    if (timelineZoom >= 80) return 2;       // every 2s
    if (timelineZoom >= 40) return 5;       // every 5s
    if (timelineZoom >= 20) return 10;      // every 10s
    return 30;                               // every 30s
  }, [timelineZoom]);

  const tickInterval = getTickInterval();
  const totalWidth = Math.max(timelineDuration + 30, 60) * timelineZoom;

  // Generate tick marks
  const ticks: { time: number; major: boolean }[] = [];
  const subTickInterval = tickInterval / 5;
  for (let t = 0; t <= timelineDuration + 30; t += subTickInterval) {
    const rounded = Math.round(t * 100) / 100;
    ticks.push({
      time: rounded,
      major: Math.abs(rounded % tickInterval) < 0.01,
    });
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, (x / timelineZoom) + scrollOffset);
    onSeek(time);
  };

  return (
    <div
      ref={rulerRef}
      className="h-6 bg-muted/50 border-b relative cursor-pointer select-none overflow-hidden"
      onClick={handleClick}
    >
      <div
        className="relative h-full"
        style={{
          width: totalWidth,
          transform: `translateX(${-scrollOffset * timelineZoom}px)`,
        }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.time}
            className="absolute top-0 h-full"
            style={{ left: tick.time * timelineZoom }}
          >
            <div
              className={`absolute bottom-0 w-px ${
                tick.major
                  ? "h-3 bg-foreground/50"
                  : "h-1.5 bg-foreground/20"
              }`}
            />
            {tick.major && (
              <span className="absolute top-0 text-[10px] text-muted-foreground font-mono ml-1 whitespace-nowrap">
                {formatRulerTime(tick.time)}
              </span>
            )}
          </div>
        ))}

        {/* Playhead indicator on ruler */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
          style={{ left: currentTime * timelineZoom }}
        >
          <div className="absolute -top-0.5 -left-1.5 w-3.5 h-2.5 bg-red-500 rounded-sm" />
        </div>
      </div>
    </div>
  );
}
