"use client";

import { useMemo } from "react";
import { useVideoStore } from "./hooks/use-video-store";
import type { CaptionSegment } from "@/lib/video-editor/types";

/**
 * Renders live caption text on the video preview.
 * Positioned as an overlay within the preview area.
 * Reads currentTime directly from the store.
 */
export function CaptionPreview() {
  const clips = useVideoStore((s) => s.clips);
  const currentTime = useVideoStore((s) => s.currentTime);
  const captionSettings = useVideoStore((s) => s.captionSettings);

  // Find active caption clips at current time
  const activeCaption = useMemo(() => {
    const captionClips = Object.values(clips).filter(
      (c) => c.type === "caption" && c.captionData
    );

    for (const clip of captionClips) {
      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;

      if (currentTime >= clipStart && currentTime < clipEnd) {
        const relativeTime = currentTime - clipStart;
        const data = clip.captionData!;

        // Find active segment
        const segment = data.segments.find(
          (s) => relativeTime >= s.startTime && relativeTime < s.endTime
        );

        if (segment) {
          // For karaoke: find active word
          let activeWordIndex = -1;
          if (data.captionStyleId === "karaoke") {
            activeWordIndex = segment.words.findIndex(
              (w) => relativeTime >= w.startTime && relativeTime < w.endTime
            );
          }

          return {
            segment,
            styleId: data.captionStyleId,
            activeWordIndex,
          };
        }
      }
    }

    return null;
  }, [clips, currentTime]);

  if (!activeCaption) return null;

  const { segment, styleId, activeWordIndex } = activeCaption;
  const position = captionSettings.globalPosition;

  // Position styles
  const positionStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    ...(position === "top"
      ? { top: "8%" }
      : position === "center"
        ? { top: "50%", transform: "translate(-50%, -50%)" }
        : { bottom: "8%" }),
    maxWidth: "90%",
    textAlign: "center" as const,
    pointerEvents: "none" as const,
    zIndex: 20,
  };

  // Render based on style
  return (
    <div style={positionStyle}>
      {renderCaptionText(segment, styleId, activeWordIndex)}
    </div>
  );
}

function renderCaptionText(
  segment: CaptionSegment,
  styleId: string,
  activeWordIndex: number
) {
  const baseClasses = "leading-tight drop-shadow-lg";

  switch (styleId) {
    case "karaoke":
      return (
        <p className={`${baseClasses} text-2xl font-bold`}>
          {segment.words.map((word, i) => (
            <span
              key={i}
              className={
                i === activeWordIndex
                  ? "text-yellow-300 scale-110 inline-block mx-0.5"
                  : "text-white mx-0.5"
              }
            >
              {word.word}
            </span>
          ))}
        </p>
      );

    case "neon":
      return (
        <p
          className={`${baseClasses} text-2xl font-bold`}
          style={{
            color: "#00FFFF",
            textShadow:
              "0 0 7px #00FFFF, 0 0 10px #00FFFF, 0 0 21px #00FFFF, 0 0 42px #0fa",
          }}
        >
          {segment.text}
        </p>
      );

    case "minimal":
      return (
        <p
          className={`${baseClasses} text-sm font-normal text-white/90`}
          style={{ textAlign: "left", transform: "none", left: "5%", position: "relative" }}
        >
          {segment.text}
        </p>
      );

    case "subtitle_bar":
      return (
        <div className="bg-black/70 px-6 py-2 rounded-sm w-full">
          <p className={`${baseClasses} text-lg text-white text-center`}>
            {segment.text}
          </p>
        </div>
      );

    case "bold_pop":
      return (
        <p
          className={`${baseClasses} text-3xl font-black text-white uppercase`}
          style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.7)" }}
        >
          {segment.text}
        </p>
      );

    case "boxed":
      return (
        <div className="bg-black/60 px-4 py-2 rounded-lg inline-block">
          <p className={`${baseClasses} text-xl text-white`}>
            {segment.text}
          </p>
        </div>
      );

    case "cinematic":
      return (
        <p
          className={`${baseClasses} text-xl text-white/95 italic`}
          style={{ fontFamily: "Georgia, serif" }}
        >
          {segment.text}
        </p>
      );

    case "colorful":
      return (
        <p
          className={`${baseClasses} text-2xl font-bold`}
          style={{
            background: "linear-gradient(90deg, #FF6B6B, #4ECDC4, #FFE66D, #A8E6CF, #FF8B94)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "none",
            filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.5))",
          }}
        >
          {segment.text}
        </p>
      );

    // classic and default
    default:
      return (
        <p
          className={`${baseClasses} text-xl font-medium text-white`}
          style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 rgba(0,0,0,0.5)" }}
        >
          {segment.text}
        </p>
      );
  }
}
