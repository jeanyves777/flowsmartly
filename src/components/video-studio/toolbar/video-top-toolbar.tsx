"use client";

import { useState, useRef, useEffect, memo } from "react";
import {
  Undo2,
  Redo2,
  Play,
  Pause,
  Square,
  SkipBack,
  Download,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useVideoStore } from "../hooks/use-video-store";
import { ExportDialog } from "../export-dialog";

interface PlaybackControls {
  play: () => void;
  pause: () => void;
  stop: () => void;
  isPlaying: boolean;
}

interface HistoryControls {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface VideoTopToolbarProps {
  onSave: () => void;
  playback: PlaybackControls;
  history: HistoryControls;
}

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
}

/**
 * Isolated time display — subscribes to currentTime directly so only
 * this tiny component re-renders at 60fps during playback, not the
 * entire toolbar or layout tree.
 */
const TimeDisplay = memo(function TimeDisplay() {
  const currentTime = useVideoStore((s) => s.currentTime);
  const timelineDuration = useVideoStore((s) => s.timelineDuration);

  return (
    <span className="text-xs font-mono text-muted-foreground min-w-[110px] text-center tabular-nums">
      {formatTime(currentTime)} / {formatTime(timelineDuration)}
    </span>
  );
});

export function VideoTopToolbar({
  onSave,
  playback,
  history,
}: VideoTopToolbarProps) {
  const project = useVideoStore((s) => s.project);
  const setProject = useVideoStore((s) => s.setProject);
  const isDirty = useVideoStore((s) => s.isDirty);
  const isExporting = useVideoStore((s) => s.isExporting);
  const playbackSpeed = useVideoStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useVideoStore((s) => s.setPlaybackSpeed);

  const [isEditingName, setIsEditingName] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (!project.name.trim()) {
      setProject({ name: "Untitled Video" });
    }
  };

  return (
    <div className="flex items-center justify-between h-12 px-3 border-b bg-background shrink-0">
      {/* Left: Project name + save */}
      <div className="flex items-center gap-2 min-w-0">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={project.name}
            onChange={(e) => setProject({ name: e.target.value })}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleNameSubmit();
              if (e.key === "Escape") setIsEditingName(false);
            }}
            className="text-sm font-medium bg-transparent border-b border-brand-500 outline-none px-1 max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-medium truncate max-w-[200px] hover:text-brand-600 transition-colors"
          >
            {project.name}
            {isDirty && (
              <span className="text-muted-foreground ml-1">*</span>
            )}
          </button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onSave}
          title="Save (Ctrl+S)"
        >
          <Save className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Undo/Redo + Transport + Time + Speed */}
      <div className="flex items-center gap-1">
        {/* Undo/Redo */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={history.undo}
          disabled={!history.canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={history.redo}
          disabled={!history.canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Transport controls */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={playback.stop}
          title="Return to start"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="icon"
          className="h-8 w-8 bg-brand-500 hover:bg-brand-600 text-white"
          onClick={playback.isPlaying ? playback.pause : playback.play}
          title={playback.isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {playback.isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>

        {playback.isPlaying && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={playback.stop}
            title="Stop"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Time display — isolated component to avoid 60fps re-renders */}
        <TimeDisplay />

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Playback Speed */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-mono px-2 min-w-[42px]"
              title="Playback speed"
            >
              {playbackSpeed}x
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {SPEED_OPTIONS.map((speed) => (
              <DropdownMenuItem
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={playbackSpeed === speed ? "bg-brand-500/10 font-medium" : ""}
              >
                {speed}x {speed === 1 && "(Normal)"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border mx-1.5" />

        {/* Resolution */}
        <span className="text-xs text-muted-foreground font-mono">
          {project.width}x{project.height}
        </span>
      </div>

      {/* Right: Export */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={isExporting}
          onClick={() => setShowExportDialog(true)}
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export"}
        </Button>
      </div>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </div>
  );
}
