"use client";

import { useMemo } from "react";
import { useVideoStore } from "./hooks/use-video-store";
import { CaptionPreview } from "./caption-preview";

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  isPlaying: boolean;
  currentTime: number;
}

interface VideoPreviewProps {
  playback: PlaybackControls;
}

export function VideoPreview({ playback }: VideoPreviewProps) {
  const project = useVideoStore((s) => s.project);
  const clips = useVideoStore((s) => s.clips);
  const tracks = useVideoStore((s) => s.tracks);

  // Find active video/image clips at current time
  const activeVideoClips = useMemo(() => {
    const ct = playback.currentTime;
    return Object.values(clips)
      .filter((clip) => {
        if (clip.type !== "video" && clip.type !== "image") return false;
        const clipEnd = clip.startTime + clip.duration;
        return ct >= clip.startTime && ct < clipEnd;
      })
      .sort((a, b) => {
        // Sort by track order (higher tracks render first = behind)
        const aTrackIdx = tracks.findIndex((t) => t.id === a.trackId);
        const bTrackIdx = tracks.findIndex((t) => t.id === b.trackId);
        return aTrackIdx - bTrackIdx;
      });
  }, [clips, tracks, playback.currentTime]);

  // Calculate preview container size to maintain aspect ratio
  const aspectRatio = project.width / project.height;

  return (
    <div className="flex-1 flex items-center justify-center bg-muted/30 overflow-hidden p-4">
      {/* Aspect-ratio-locked preview box */}
      <div
        className="relative bg-black rounded-lg shadow-lg overflow-hidden"
        style={{
          aspectRatio: `${project.width} / ${project.height}`,
          maxWidth: "100%",
          maxHeight: "100%",
          width: aspectRatio >= 1 ? "100%" : "auto",
          height: aspectRatio < 1 ? "100%" : "auto",
        }}
      >
        {/* Checkerboard background for transparency */}
        <div
          className="absolute inset-0"
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

        {/* Stacked video/image elements */}
        {activeVideoClips.map((clip) => (
          <div key={clip.id} className="absolute inset-0">
            {clip.type === "video" && clip.sourceUrl ? (
              <video
                data-video-editor-clip={clip.id}
                src={clip.sourceUrl}
                className="w-full h-full object-contain"
                muted={clip.muted}
                playsInline
              />
            ) : clip.type === "image" && clip.sourceUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clip.sourceUrl}
                alt={clip.name}
                className="w-full h-full object-contain"
              />
            ) : null}
          </div>
        ))}

        {/* Empty state */}
        {activeVideoClips.length === 0 && Object.keys(clips).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
            <svg
              className="w-16 h-16 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            <p className="text-sm">Add media to get started</p>
            <p className="text-xs mt-1">
              Use the panels on the left or drag files here
            </p>
          </div>
        )}

        {/* Live caption overlay */}
        <CaptionPreview currentTime={playback.currentTime} />

        {/* Audio elements (hidden, for playback sync) */}
        {Object.values(clips)
          .filter(
            (clip) =>
              (clip.type === "audio" || clip.type === "voiceover") &&
              clip.sourceUrl
          )
          .map((clip) => (
            <audio
              key={clip.id}
              data-video-editor-clip={clip.id}
              src={clip.sourceUrl}
              preload="auto"
            />
          ))}
      </div>
    </div>
  );
}
