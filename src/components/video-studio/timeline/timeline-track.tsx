"use client";

import { Eye, EyeOff, Lock, Unlock, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useVideoStore } from "../hooks/use-video-store";
import { TimelineClip } from "./timeline-clip";
import type { TimelineTrack as TimelineTrackType } from "@/lib/video-editor/types";

interface TimelineTrackProps {
  track: TimelineTrackType;
}

export function TimelineTrack({ track }: TimelineTrackProps) {
  const clips = useVideoStore((s) => s.clips);
  const updateTrack = useVideoStore((s) => s.updateTrack);
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const scrollOffset = useVideoStore((s) => s.scrollOffset);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);
  const setSelectedClipIds = useVideoStore((s) => s.setSelectedClipIds);

  const trackClips = track.clips
    .map((id) => clips[id])
    .filter(Boolean);

  const totalWidth = Math.max(timelineDuration + 30, 60) * timelineZoom;

  const handleTrackClick = (e: React.MouseEvent) => {
    // Deselect clips when clicking empty area
    if (e.target === e.currentTarget) {
      setSelectedClipIds([]);
    }
  };

  return (
    <div
      className={cn(
        "flex border-b border-border/50",
        track.locked && "opacity-60",
        !track.visible && "opacity-40"
      )}
      style={{ height: track.height }}
    >
      {/* Track header */}
      <div className="w-[140px] shrink-0 border-r bg-muted/30 flex items-center px-2 gap-1">
        <span className="text-[11px] font-medium truncate flex-1">
          {track.name}
        </span>
        <div className="flex gap-0.5">
          {(track.type === "audio" || track.type === "video") && (
            <button
              onClick={() => updateTrack(track.id, { muted: !track.muted })}
              className="p-0.5 rounded hover:bg-muted"
              title={track.muted ? "Unmute" : "Mute"}
            >
              {track.muted ? (
                <VolumeX className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Volume2 className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
          <button
            onClick={() => updateTrack(track.id, { locked: !track.locked })}
            className="p-0.5 rounded hover:bg-muted"
            title={track.locked ? "Unlock" : "Lock"}
          >
            {track.locked ? (
              <Lock className="h-3 w-3 text-muted-foreground" />
            ) : (
              <Unlock className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => updateTrack(track.id, { visible: !track.visible })}
            className="p-0.5 rounded hover:bg-muted"
            title={track.visible ? "Hide" : "Show"}
          >
            {track.visible ? (
              <Eye className="h-3 w-3 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Track clip area */}
      <div
        className="flex-1 relative overflow-hidden"
        onClick={handleTrackClick}
      >
        <div
          className="relative h-full"
          style={{
            width: totalWidth,
            transform: `translateX(${-scrollOffset * timelineZoom}px)`,
          }}
        >
          {trackClips.map((clip) => (
            <TimelineClip key={clip.id} clip={clip} />
          ))}
        </div>
      </div>
    </div>
  );
}
