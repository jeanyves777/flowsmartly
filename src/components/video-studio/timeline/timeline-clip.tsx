"use client";

import { useRef, useState, useCallback } from "react";
import { Scissors, Trash2, Copy, Volume2, Film, Image, Music, Mic, Type as TypeIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useVideoStore } from "../hooks/use-video-store";
import { CLIP_COLORS } from "@/lib/video-editor/types";
import type { TimelineClip as TimelineClipType, ClipType } from "@/lib/video-editor/types";

const CLIP_ICONS: Record<ClipType, typeof Film> = {
  video: Film,
  image: Image,
  audio: Music,
  voiceover: Mic,
  caption: TypeIcon,
  text: TypeIcon,
};

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
  const dragStartRef = useRef({ x: 0, startTime: 0 });

  const isSelected = selectedClipIds.includes(clip.id);
  const width = clip.duration * timelineZoom;
  const left = clip.startTime * timelineZoom;
  const bgColor = CLIP_COLORS[clip.type] || "#6b7280";
  const ClipIcon = CLIP_ICONS[clip.type] || Film;

  // Whether this clip type allows free duration extension (no fixed source length)
  const canExtendDuration = clip.type === "image" || clip.type === "text" || clip.type === "caption";

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

  // Edge handles — trim for video/audio, extend for image/text
  const handleEdgeDrag = useCallback(
    (side: "left" | "right", e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const origStartTime = clip.startTime;
      const origDuration = clip.duration;
      const origTrimStart = clip.trimStart;
      const origTrimEnd = clip.trimEnd;

      const handleMove = (me: MouseEvent) => {
        const dx = me.clientX - startX;
        const dt = dx / timelineZoom;

        if (side === "left") {
          if (canExtendDuration) {
            // For images/text: freely adjust start time and duration
            const delta = Math.min(dt, origDuration - 0.1);
            const newStart = Math.max(0, origStartTime + delta);
            const actualDelta = newStart - origStartTime;
            updateClip(clip.id, {
              startTime: newStart,
              duration: origDuration - actualDelta,
            });
          } else {
            // For video/audio: trim from source start
            const maxTrim = origDuration - 0.1;
            const trimDelta = Math.max(-origTrimStart, Math.min(maxTrim, dt));
            updateClip(clip.id, {
              startTime: origStartTime + trimDelta,
              duration: origDuration - trimDelta,
              trimStart: origTrimStart + trimDelta,
            });
          }
        } else {
          if (canExtendDuration) {
            // For images/text: freely extend or shrink duration
            const newDuration = Math.max(0.1, origDuration + dt);
            updateClip(clip.id, {
              duration: newDuration,
              sourceDuration: newDuration,
            });
          } else {
            // For video/audio: trim from source end
            const maxTrim = origDuration - 0.1;
            const trimDelta = Math.max(-origTrimEnd, Math.min(maxTrim, -dt));
            updateClip(clip.id, {
              duration: origDuration - trimDelta,
              trimEnd: origTrimEnd + trimDelta,
            });
          }
        }
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [clip, timelineZoom, updateClip, canExtendDuration]
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
            ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
            ${isDragging ? "opacity-75 z-20" : "z-10"}
            hover:brightness-110 transition-[filter]`}
          style={{ left, width: Math.max(width, 4), backgroundColor: bgColor }}
          onClick={handleClick}
          onMouseDown={handleDragStart}
          onContextMenu={handleContextMenu}
        >
          {/* Left edge handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-30 group"
            onMouseDown={(e) => handleEdgeDrag("left", e)}
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/0 group-hover:bg-white/50 rounded-l-md transition-colors" />
          </div>

          {/* Clip content — icon + label */}
          <div className="flex items-center h-full px-2.5 overflow-hidden pointer-events-none gap-1.5">
            <ClipIcon className="h-3 w-3 text-white/70 shrink-0" />
            {clip.muted && <Volume2 className="h-3 w-3 opacity-50 shrink-0" />}
            <span className="text-[11px] text-white font-medium truncate drop-shadow-sm">
              {clipLabel}
            </span>
          </div>

          {/* Right edge handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize z-30 group"
            onMouseDown={(e) => handleEdgeDrag("right", e)}
          >
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/0 group-hover:bg-white/50 rounded-r-md transition-colors" />
          </div>
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
