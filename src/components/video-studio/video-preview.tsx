"use client";

import { useMemo, useRef, useCallback } from "react";
import { useVideoStore } from "./hooks/use-video-store";
import { CaptionPreview } from "./caption-preview";
import type { TimelineClip } from "@/lib/video-editor/types";

interface VideoPreviewProps {
  playback: { isPlaying: boolean };
}

export function VideoPreview({ playback }: VideoPreviewProps) {
  const project = useVideoStore((s) => s.project);
  const clips = useVideoStore((s) => s.clips);
  const tracks = useVideoStore((s) => s.tracks);
  const currentTime = useVideoStore((s) => s.currentTime);
  const selectedClipIds = useVideoStore((s) => s.selectedClipIds);
  const setSelectedClipIds = useVideoStore((s) => s.setSelectedClipIds);
  const updateClip = useVideoStore((s) => s.updateClip);

  const previewRef = useRef<HTMLDivElement>(null);

  // Find active video/image clips at current time
  const activeVideoClips = useMemo(() => {
    const ct = currentTime;
    return Object.values(clips)
      .filter((clip) => {
        if (clip.type !== "video" && clip.type !== "image") return false;
        const clipEnd = clip.startTime + clip.duration;
        return ct >= clip.startTime && ct < clipEnd;
      })
      .sort((a, b) => {
        const aTrackIdx = tracks.findIndex((t) => t.id === a.trackId);
        const bTrackIdx = tracks.findIndex((t) => t.id === b.trackId);
        return aTrackIdx - bTrackIdx;
      });
  }, [clips, tracks, currentTime]);

  // Find active text clips at current time
  const activeTextClips = useMemo(() => {
    const ct = currentTime;
    return Object.values(clips)
      .filter((clip) => {
        if (clip.type !== "text") return false;
        const clipEnd = clip.startTime + clip.duration;
        return ct >= clip.startTime && ct < clipEnd;
      });
  }, [clips, currentTime]);

  const handleClipClick = (e: React.MouseEvent, clip: TimelineClip) => {
    e.stopPropagation();
    if (e.shiftKey) {
      const isSelected = selectedClipIds.includes(clip.id);
      setSelectedClipIds(
        isSelected
          ? selectedClipIds.filter((id) => id !== clip.id)
          : [...selectedClipIds, clip.id]
      );
    } else {
      setSelectedClipIds([clip.id]);
    }
  };

  const handleBackgroundClick = () => {
    setSelectedClipIds([]);
  };

  // ─── Drag to move ────────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedClipIds([clip.id]);

      const container = previewRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;

      const t = clip.transform || { x: 0, y: 0, scale: 1 };
      const origX = t.x;
      const origY = t.y;

      // For text clips, use textStyle.position
      const isText = clip.type === "text" && clip.textStyle;
      const origPosX = isText ? clip.textStyle!.position.x : 0;
      const origPosY = isText ? clip.textStyle!.position.y : 0;

      const handleMove = (me: MouseEvent) => {
        const dx = ((me.clientX - startX) / rect.width) * 100;
        const dy = ((me.clientY - startY) / rect.height) * 100;

        if (isText) {
          updateClip(clip.id, {
            textStyle: {
              ...clip.textStyle!,
              position: {
                x: Math.max(0, Math.min(100, origPosX + dx)),
                y: Math.max(0, Math.min(100, origPosY + dy)),
              },
            },
          });
        } else {
          updateClip(clip.id, {
            transform: { ...t, x: origX + dx, y: origY + dy },
          });
        }
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [setSelectedClipIds, updateClip]
  );

  // ─── Resize (corner drag) ───────────────────────────────────
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, clip: TimelineClip, corner: string) => {
      e.preventDefault();
      e.stopPropagation();

      const container = previewRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;

      const t = clip.transform || { x: 0, y: 0, scale: 1 };
      const origScale = t.scale;

      const handleMove = (me: MouseEvent) => {
        // Use diagonal distance for scale
        const dx = (me.clientX - startX) / rect.width;
        const dy = (me.clientY - startY) / rect.height;

        let delta = 0;
        if (corner === "br" || corner === "tr") delta = dx + dy;
        else if (corner === "bl" || corner === "tl") delta = -dx + dy;
        else delta = dy;

        // Bottom corners: drag down = larger. Top corners: drag up = larger.
        if (corner === "tl" || corner === "tr") delta = -delta;

        const newScale = Math.max(0.1, Math.min(5, origScale + delta * 2));
        updateClip(clip.id, {
          transform: { ...t, scale: newScale },
        });
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [updateClip]
  );

  // ─── Text resize (font size via corner drag) ──────────────────
  const handleTextResizeStart = useCallback(
    (e: React.MouseEvent, clip: TimelineClip) => {
      e.preventDefault();
      e.stopPropagation();

      const container = previewRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const startY = e.clientY;
      const origFontSize = clip.textStyle?.fontSize || 36;

      const handleMove = (me: MouseEvent) => {
        const dy = (me.clientY - startY) / rect.height;
        const newSize = Math.max(8, Math.min(200, Math.round(origFontSize + dy * 200)));
        updateClip(clip.id, {
          textStyle: { ...clip.textStyle!, fontSize: newSize },
        });
      };

      const handleUp = () => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [updateClip]
  );

  const aspectRatio = project.width / project.height;

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30 overflow-hidden p-4">
      {/* Aspect-ratio-locked preview box */}
      <div
        ref={previewRef}
        className="relative bg-black rounded-lg shadow-lg overflow-hidden"
        style={{
          aspectRatio: `${project.width} / ${project.height}`,
          maxWidth: "100%",
          maxHeight: "100%",
          width: aspectRatio >= 1 ? "100%" : "auto",
          height: aspectRatio < 1 ? "100%" : "auto",
        }}
        onClick={handleBackgroundClick}
      >
        {/* Checkerboard background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #1a1a2e 25%, transparent 25%),
              linear-gradient(-45deg, #1a1a2e 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #1a1a2e 75%),
              linear-gradient(-45deg, transparent 75%, #1a1a2e 75%)
            `,
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />

        {/* Video/image elements — draggable & resizable with transitions */}
        {activeVideoClips.map((clip) => {
          const isSelected = selectedClipIds.includes(clip.id);
          const t = clip.transform || { x: 0, y: 0, scale: 1 };
          const clipOpacity = clip.opacity ?? 1;

          // Transition effects
          let transOpacity = 1;
          let transClipPath: string | undefined;
          let transX = 0;

          if (clip.transitionType && clip.transitionType !== "none") {
            const transDur = clip.transitionDuration || 0.5;
            const elapsed = currentTime - clip.startTime;
            const progress = Math.min(1, Math.max(0, elapsed / transDur));

            if (progress < 1) {
              switch (clip.transitionType) {
                case "crossfade":
                case "dissolve":
                  transOpacity = progress;
                  break;
                case "wipe-left":
                  transClipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`;
                  break;
                case "wipe-right":
                  transClipPath = `inset(0 0 0 ${(1 - progress) * 100}%)`;
                  break;
                case "slide":
                  transX = (1 - progress) * 100;
                  break;
              }
            }
          }

          return (
            <div
              key={clip.id}
              className="absolute cursor-move"
              style={{
                inset: 0,
                transform: `translate(${t.x + transX}%, ${t.y}%) scale(${t.scale})`,
                transformOrigin: "center center",
                opacity: clipOpacity * transOpacity,
                clipPath: transClipPath,
              }}
              onClick={(e) => handleClipClick(e, clip)}
              onMouseDown={(e) => handleDragStart(e, clip)}
            >
              {clip.type === "video" && clip.sourceUrl ? (
                <video
                  data-video-editor-clip={clip.id}
                  src={clip.sourceUrl}
                  className="w-full h-full object-contain pointer-events-none"
                  muted={clip.muted}
                  playsInline
                />
              ) : clip.type === "image" && clip.sourceUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clip.sourceUrl}
                  alt={clip.name}
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
              ) : null}

              {/* Selection border + corner handles */}
              {isSelected && (
                <>
                  <div className="absolute inset-0 border-2 border-brand-500 pointer-events-none rounded" />
                  {/* Name badge */}
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-brand-500 rounded text-[10px] text-white font-medium pointer-events-none">
                    {clip.name}
                  </div>
                  {/* Corner resize handles */}
                  {["tl", "tr", "bl", "br"].map((corner) => (
                    <div
                      key={corner}
                      className={`absolute w-4 h-4 z-10 ${
                        corner === "tl" ? "top-0 left-0 cursor-nwse-resize" :
                        corner === "tr" ? "top-0 right-0 cursor-nesw-resize" :
                        corner === "bl" ? "bottom-0 left-0 cursor-nesw-resize" :
                        "bottom-0 right-0 cursor-nwse-resize"
                      }`}
                      onMouseDown={(e) => handleResizeStart(e, clip, corner)}
                    >
                      <div className={`absolute w-2.5 h-2.5 bg-white border-2 border-brand-500 rounded-sm ${
                        corner === "tl" ? "top-0 left-0" :
                        corner === "tr" ? "top-0 right-0" :
                        corner === "bl" ? "bottom-0 left-0" :
                        "bottom-0 right-0"
                      }`} />
                    </div>
                  ))}
                </>
              )}
            </div>
          );
        })}

        {/* Text overlays — draggable with animations */}
        {activeTextClips.map((clip) => {
          const style = clip.textStyle;
          const isSelected = selectedClipIds.includes(clip.id);
          if (!style || !clip.textContent) return null;

          // Text animation
          const animation = style.animation || "none";
          const elapsed = currentTime - clip.startTime;

          let animTransform = "translate(-50%, -50%)";
          let animOpacity = 1;
          let displayText = clip.textContent;

          if (animation !== "none") {
            const animDuration = animation === "typewriter"
              ? Math.max(0.5, clip.textContent.length * 0.04)
              : 0.5;
            const progress = Math.min(1, Math.max(0, elapsed / animDuration));

            if (progress < 1) {
              switch (animation) {
                case "fade-in":
                  animOpacity = progress;
                  break;
                case "slide-up":
                  animOpacity = progress;
                  animTransform = `translate(-50%, calc(-50% + ${(1 - progress) * 40}px))`;
                  break;
                case "slide-left":
                  animOpacity = progress;
                  animTransform = `translate(calc(-50% + ${(progress - 1) * 60}px), -50%)`;
                  break;
                case "typewriter": {
                  const charCount = Math.ceil(progress * clip.textContent.length);
                  displayText = clip.textContent.slice(0, charCount) + "\u2588";
                  break;
                }
              }
            }
          }

          return (
            <div
              key={clip.id}
              className={`absolute cursor-move ${isSelected ? "ring-2 ring-brand-500 rounded" : ""}`}
              style={{
                left: `${style.position.x}%`,
                top: `${style.position.y}%`,
                transform: animTransform,
                maxWidth: "90%",
                opacity: animOpacity,
              }}
              onClick={(e) => handleClipClick(e, clip)}
              onMouseDown={(e) => handleDragStart(e, clip)}
            >
              <div
                style={{
                  fontFamily: style.fontFamily || "sans-serif",
                  fontSize: `clamp(12px, ${style.fontSize / 16}vw, ${style.fontSize}px)`,
                  color: style.fontColor,
                  fontWeight: style.fontWeight,
                  textAlign: style.textAlign,
                  backgroundColor: style.backgroundColor || "transparent",
                  padding: style.backgroundColor ? "4px 12px" : undefined,
                  borderRadius: style.backgroundColor ? "4px" : undefined,
                  textShadow: !style.backgroundColor ? "0 2px 4px rgba(0,0,0,0.8)" : undefined,
                  whiteSpace: "pre-wrap",
                }}
              >
                {displayText}
              </div>

              {/* Text resize handle */}
              {isSelected && (
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 cursor-ns-resize z-10"
                  onMouseDown={(e) => handleTextResizeStart(e, clip)}
                >
                  <div className="w-3 h-3 bg-white border-2 border-brand-500 rounded-sm mx-auto" />
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {activeVideoClips.length === 0 && activeTextClips.length === 0 && Object.keys(clips).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
            <svg className="w-16 h-16 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm">Add media to get started</p>
            <p className="text-xs mt-1">Use the panels on the left or drag files here</p>
          </div>
        )}

        {/* Live caption overlay */}
        <CaptionPreview />

        {/* Audio elements (hidden, for playback sync) */}
        {Object.values(clips)
          .filter((clip) => (clip.type === "audio" || clip.type === "voiceover") && clip.sourceUrl)
          .map((clip) => (
            <audio key={clip.id} data-video-editor-clip={clip.id} src={clip.sourceUrl} preload="auto" />
          ))}
      </div>
    </div>
  );
}
