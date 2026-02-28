"use client";

import { useRef, useState, useCallback } from "react";
import { Scissors, Trash2, Copy, Volume2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useVideoStore } from "../hooks/use-video-store";
import { CLIP_COLORS } from "@/lib/video-editor/types";
import type { TimelineClip as TimelineClipType } from "@/lib/video-editor/types";

interface TimelineClipProps {
  clip: TimelineClipType;
}

export function TimelineClip({ clip }: TimelineClipProps) {
  const timelineZoom = useVideoStore((s) => s.timelineZoom);
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const setSelectedClipIds = useVideoStore((s) => s.setSelectedClipIds);
  const updateClip = useVideoStore((s) => s.updateClip);
  const removeClip = useVideoStore((s) => s.removeClip);
  const splitClip = useVideoStore((s) => s.splitClip);
  const duplicateClip = useVideoStore((s) => s.duplicateClip);
  const moveClip = useVideoStore((s) => s.moveClip);
  const currentTime = useVideoStore((s) => s.currentTime);

  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<"left" | "right" | null>(null);
  const dragStartRef = useRef({ x: 0, startTime: 0 });

  const isSelected = selectedClipIds.includes(clip.id);
  const width = clip.duration * timelineZoom;
  const left = clip.startTime * timelineZoom;
  const colorClass = CLIP_COLORS[clip.type] || "bg-gray-500/80";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      setSelectedClipIds(
        isSelected
          ? selectedClipIds.filter((id) => id !== clip.id)
          : [...selectedClipIds, clip.id]
      );
    } else {
      setSelectedClipIds([clip.id]);
    }
  };

  // Drag to reposition
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, startTime: clip.startTime };

      const handleMove = (me: MouseEvent) => {
        const dx = me.clientX - dragStartRef.current.x;
        const dt = dx / timelineZoom;
        const newStart = Math.max(0, dragStartRef.current.startTime + dt);
        moveClip(clip.id, clip.trackId, newStart);
      };

      const handleUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [clip.id, clip.trackId, clip.startTime, timelineZoom, moveClip]
  );

  // Trim handles
  const handleTrimStart = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsTrimming(side);
      const startX = e.clientX;
      const origStartTime = clip.startTime;
      const origDuration = clip.duration;
      const origTrimStart = clip.trimStart;
      const origTrimEnd = clip.trimEnd;

      const handleMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dt = dx / timelineZoom;

        if (side === "left") {
          const maxTrim = origDuration - 0.1;
          const trimDelta = Math.max(-origTrimStart, Math.min(maxTrim, dt));
          updateClip(clip.id, {
            startTime: origStartTime + trimDelta,
            duration: origDuration - trimDelta,
            trimStart: origTrimStart + trimDelta,
          });
        } else {
          const maxTrim = origDuration - 0.1;
          const trimDelta = Math.max(-origTrimEnd, Math.min(maxTrim, -dt));
          updateClip(clip.id, {
            duration: origDuration - trimDelta,
            trimEnd: origTrimEnd + trimDelta,
          });
        }
      };

      const handleUp = () => {
        setIsTrimming(null);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [clip, timelineZoom, updateClip]
  );

  const handleSplit = () => {
    if (currentTime > clip.startTime && currentTime < clip.startTime + clip.duration) {
      splitClip(clip.id, currentTime);
    }
  };

  const clipLabel = clip.name || clip.type;
  const [menuOpen, setMenuOpen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(true);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <div
          ref={clipRef}
          className={`absolute top-1 bottom-1 rounded-md cursor-pointer select-none
            ${colorClass}
            ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
            ${isDragging ? "opacity-75 z-20" : "z-10"}
            hover:brightness-110 transition-[filter]`}
          style={{ left, width: Math.max(width, 4) }}
          onClick={handleClick}
          onMouseDown={handleDragStart}
          onContextMenu={handleContextMenu}
        >
          {/* Left trim handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-30 hover:bg-white/30 rounded-l-md"
            onMouseDown={(e) => handleTrimStart("left", e)}
          />

          {/* Clip content */}
          <div className="flex items-center h-full px-3 overflow-hidden pointer-events-none">
            {clip.muted && <Volume2 className="h-3 w-3 mr-1 opacity-50 shrink-0" />}
            <span className="text-[11px] text-white font-medium truncate drop-shadow-sm">
              {clipLabel}
            </span>
          </div>

          {/* Right trim handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-30 hover:bg-white/30 rounded-r-md"
            onMouseDown={(e) => handleTrimStart("right", e)}
          />
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleSplit}>
          <Scissors className="h-4 w-4 mr-2" />
          Split at Playhead
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => duplicateClip(clip.id)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => removeClip(clip.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
