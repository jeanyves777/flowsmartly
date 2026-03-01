"use client";

import { useCallback } from "react";
import { useVideoStore } from "./hooks/use-video-store";
import { useVideoHistory } from "./hooks/use-video-history";
import { useVideoShortcuts } from "./hooks/use-video-shortcuts";
import { useVideoPlayback } from "./hooks/use-video-playback";
import { VideoTopToolbar } from "./toolbar/video-top-toolbar";
import { VideoPreview } from "./video-preview";
import { VideoTimeline } from "./timeline/video-timeline";
import { VideoLeftPanel } from "./panels/video-left-panel";
import { VideoRightPanel } from "./panels/video-right-panel";

interface VideoStudioLayoutProps {
  onSave: () => void;
}

export function VideoStudioLayout({ onSave }: VideoStudioLayoutProps) {
  // Wire up hooks
  const history = useVideoHistory();
  useVideoShortcuts();
  const playback = useVideoPlayback();

  const handleSeek = useCallback(
    (time: number) => {
      useVideoStore.getState().setCurrentTime(Math.max(0, time));
    },
    []
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Top Toolbar */}
      <VideoTopToolbar
        onSave={onSave}
        playback={playback}
        history={history}
      />

      {/* Main Content: Left Panel + Preview + Right Panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel */}
        <VideoLeftPanel />

        {/* Center Preview */}
        <div className="flex-1 flex flex-col relative min-h-0 overflow-hidden">
          <VideoPreview playback={playback} />
        </div>

        {/* Right Panel */}
        <VideoRightPanel />
      </div>

      {/* Timeline */}
      <VideoTimeline onSeek={handleSeek} />
    </div>
  );
}
