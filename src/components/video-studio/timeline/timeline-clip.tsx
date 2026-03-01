"use client";

import { useRef, useState, useCallback } from "react";
import { Scissors, Trash2, Copy, Volume2, Film, Image, Music, Mic, Type as TypeIcon, X } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
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
  const hasDraggedRef = useRef(false);

  const isSelected = selectedClipIds.includes(clip.id);
  const width = clip.duration * timelineZoom;
  const left = clip.startTime * timelineZoom;
  const bgColor = CLIP_COLORS[clip.type] || "#6b7280";
  const ClipIcon = CLIP_ICONS[clip.type] || Film;

  // Whether this clip type allows free duration extension (no fixed source length)
  const canExtendDuration = clip.type === "image" || clip.type === "text" || clip.type === "caption";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't trigger selection change if we just dragged
    if (hasDraggedRef.current) return;

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

  // ─── Snap helper ───────────────────────────────────────────
  const snapPosition = useCallback(
    (newStart: number, trackId: string, clipDuration: number): number => {
      const store = useVideoStore.getState();
      if (!store.snapEnabled) return newStart;

      const SNAP_THRESHOLD_PX = 8;
      const snapThreshold = SNAP_THRESHOLD_PX / timelineZoom;

      // Collect snap points
      const snapPoints: number[] = [0, store.currentTime];

      // Snap to other clip edges on this track
      const track = store.tracks.find((t) => t.id === trackId);
      if (track) {
        for (const cId of track.clips) {
          if (cId === clip.id) continue;
          const c = store.clips[cId];
          if (c) {
            snapPoints.push(c.startTime);
            snapPoints.push(c.startTime + c.duration);
          }
        }
      }

      // Also snap to clip edges on all tracks (playhead-style global snap)
      for (const c of Object.values(store.clips)) {
        if (c.id === clip.id) continue;
        const end = c.startTime + c.duration;
        if (!snapPoints.includes(c.startTime)) snapPoints.push(c.startTime);
        if (!snapPoints.includes(end)) snapPoints.push(end);
      }

      // Find nearest snap point for clip start OR end
      let snapped = newStart;
      let minDist = snapThreshold;

      for (const sp of snapPoints) {
        // Snap start of clip to snap point
        const distStart = Math.abs(newStart - sp);
        if (distStart < minDist) {
          snapped = sp;
          minDist = distStart;
        }
        // Snap end of clip to snap point
        const distEnd = Math.abs(newStart + clipDuration - sp);
        if (distEnd < minDist) {
          snapped = sp - clipDuration;
          minDist = distEnd;
        }
      }

      return Math.max(0, snapped);
    },
    [clip.id, timelineZoom]
  );

  // Drag to reposition (horizontal + cross-track vertical)
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Only drag on left mouse button
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      hasDraggedRef.current = false;
      dragStartRef.current = { x: e.clientX, startTime: clip.startTime };

      // Track the target track ID — only commit on mouseUp
      let targetTrackId = clip.trackId;

      // Cache the tracks container for cross-track detection
      const tracksContainer = document.querySelector("[data-timeline-tracks]");

      const handleMove = (me: MouseEvent) => {
        hasDraggedRef.current = true;
        const dx = me.clientX - dragStartRef.current.x;
        const dt = dx / timelineZoom;
        const rawStart = Math.max(0, dragStartRef.current.startTime + dt);

        // Snap
        const snappedStart = snapPosition(rawStart, targetTrackId, clip.duration);

        // Cross-track detection based on Y position in tracks container
        if (tracksContainer) {
          const containerRect = tracksContainer.getBoundingClientRect();
          const relY = me.clientY - containerRect.top + tracksContainer.scrollTop;
          const store = useVideoStore.getState();
          let cumulativeHeight = 0;
          for (const track of store.tracks) {
            if (relY >= cumulativeHeight && relY < cumulativeHeight + track.height) {
              targetTrackId = track.id;
              break;
            }
            cumulativeHeight += track.height;
          }
        }

        // Only update startTime during drag (keep clip on same track)
        // Cross-track move is deferred to mouseUp to prevent unmount
        updateClip(clip.id, { startTime: snappedStart });
      };

      const handleUp = () => {
        setIsDragging(false);
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);

        // Commit cross-track move on mouseUp if track changed
        if (targetTrackId !== clip.trackId) {
          const finalClip = useVideoStore.getState().clips[clip.id];
          if (finalClip) {
            moveClip(clip.id, targetTrackId, finalClip.startTime);
          }
        }
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [clip.id, clip.trackId, clip.startTime, clip.duration, timelineZoom, updateClip, moveClip, snapPosition]
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
            const delta = Math.min(dt, origDuration - 0.1);
            const newStart = Math.max(0, origStartTime + delta);
            const actualDelta = newStart - origStartTime;
            updateClip(clip.id, {
              startTime: newStart,
              duration: origDuration - actualDelta,
            });
          } else {
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
            const newDuration = Math.max(0.1, origDuration + dt);
            updateClip(clip.id, {
              duration: newDuration,
              sourceDuration: newDuration,
            });
          } else {
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

  // Transition visual widths (in px)
  const transInWidth = clip.transitionType && clip.transitionType !== "none"
    ? Math.min((clip.transitionDuration || 0.5) * timelineZoom, width * 0.4)
    : 0;
  const transOutWidth = clip.transitionOutType && clip.transitionOutType !== "none"
    ? Math.min((clip.transitionOutDuration || 0.5) * timelineZoom, width * 0.4)
    : 0;

  // Drop zone states
  const [dropLeft, setDropLeft] = useState(false);
  const [dropRight, setDropRight] = useState(false);

  const isVideoOrImage = clip.type === "video" || clip.type === "image";

  const handleDrop = (side: "in" | "out", e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropLeft(false);
    setDropRight(false);
    const transitionType = e.dataTransfer.getData("transition-type");
    if (!transitionType) return;
    if (side === "in") {
      updateClip(clip.id, {
        transitionType: transitionType as typeof clip.transitionType,
        transitionDuration: clip.transitionDuration || 0.5,
      });
    } else {
      updateClip(clip.id, {
        transitionOutType: transitionType as typeof clip.transitionOutType,
        transitionOutDuration: clip.transitionOutDuration || 0.5,
      });
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("transition-type") && isVideoOrImage) {
      e.preventDefault();
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={clipRef}
          className={`absolute top-1 bottom-1 rounded-md cursor-pointer select-none
            ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}
            ${isDragging ? "opacity-75 z-20" : "z-10"}
            hover:brightness-110 transition-[filter]`}
          style={{ left, width: Math.max(width, 4), backgroundColor: bgColor }}
          onClick={handleClick}
          onMouseDown={handleDragStart}
        >
          {/* Transition In indicator */}
          {transInWidth > 0 && (
            <div
              className="absolute left-0 top-0 bottom-0 rounded-l-md z-20 pointer-events-none"
              style={{
                width: transInWidth,
                background: "linear-gradient(to right, rgba(255,255,255,0.35), transparent)",
              }}
            >
              <span className="absolute bottom-0.5 left-1 text-[7px] text-white/70 font-mono leading-none">
                {clip.transitionType}
              </span>
            </div>
          )}

          {/* Transition Out indicator */}
          {transOutWidth > 0 && (
            <div
              className="absolute right-0 top-0 bottom-0 rounded-r-md z-20 pointer-events-none"
              style={{
                width: transOutWidth,
                background: "linear-gradient(to left, rgba(255,255,255,0.35), transparent)",
              }}
            >
              <span className="absolute bottom-0.5 right-1 text-[7px] text-white/70 font-mono leading-none">
                {clip.transitionOutType}
              </span>
            </div>
          )}

          {/* Left edge handle / Transition drop zone */}
          <div
            className={`absolute left-0 top-0 bottom-0 w-4 cursor-col-resize z-30 group ${
              dropLeft ? "bg-white/30" : ""
            }`}
            onMouseDown={(e) => handleEdgeDrag("left", e)}
            onDragOver={(e) => {
              handleDragOver(e);
              if (e.dataTransfer.types.includes("transition-type") && isVideoOrImage) setDropLeft(true);
            }}
            onDragLeave={() => setDropLeft(false)}
            onDrop={(e) => handleDrop("in", e)}
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
            {clip.speed && clip.speed !== 1 && (
              <span className="text-[9px] text-white/60 shrink-0">{clip.speed}x</span>
            )}
          </div>

          {/* Right edge handle / Transition drop zone */}
          <div
            className={`absolute right-0 top-0 bottom-0 w-4 cursor-col-resize z-30 group ${
              dropRight ? "bg-white/30" : ""
            }`}
            onMouseDown={(e) => handleEdgeDrag("right", e)}
            onDragOver={(e) => {
              handleDragOver(e);
              if (e.dataTransfer.types.includes("transition-type") && isVideoOrImage) setDropRight(true);
            }}
            onDragLeave={() => setDropRight(false)}
            onDrop={(e) => handleDrop("out", e)}
          >
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/0 group-hover:bg-white/50 rounded-r-md transition-colors" />
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handleSplit}>
          <Scissors className="h-4 w-4 mr-2" />
          Split at Playhead
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateClip(clip.id)}>
          <Copy className="h-4 w-4 mr-2" />
          Duplicate
        </ContextMenuItem>
        {/* Remove transitions */}
        {(clip.transitionType && clip.transitionType !== "none") && (
          <ContextMenuItem onClick={() => updateClip(clip.id, { transitionType: "none", transitionDuration: 0 })}>
            <X className="h-4 w-4 mr-2" />
            Remove Transition In
          </ContextMenuItem>
        )}
        {(clip.transitionOutType && clip.transitionOutType !== "none") && (
          <ContextMenuItem onClick={() => updateClip(clip.id, { transitionOutType: "none", transitionOutDuration: 0 })}>
            <X className="h-4 w-4 mr-2" />
            Remove Transition Out
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-red-600"
          onClick={() => removeClip(clip.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
